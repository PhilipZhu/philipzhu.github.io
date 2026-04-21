(function() {
    setTimeout(() => {
        const canvas = document.getElementById('mh-canvas');
        const trueCanvas = document.getElementById('mh-true');
        if(!canvas || !trueCanvas) return;
        
        const ctx = canvas.getContext('2d');
        const trueCtx = trueCanvas.getContext('2d');
        let w = canvas.width;
        let h = canvas.height;
        let tw = trueCanvas.width;
        let th = trueCanvas.height;
        
        function distToSegmentSq(px, py, x1, y1, x2, y2) {
            let l2 = (x2 - x1)*(x2 - x1) + (y2 - y1)*(y2 - y1);
            if (l2 === 0) return (px - x1)*(px - x1) + (py - y1)*(py - y1);
            let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
            t = Math.max(0, Math.min(1, t));
            let projX = x1 + t * (x2 - x1);
            let projY = y1 + t * (y2 - y1);
            return (px - projX)*(px - projX) + (py - projY)*(py - projY);
        }
        
        function getDensity(x, y, w, h) {
            let u = x / w; 
            let v = y / h;
            
            // 1. Original elongated distribution shrunk into the top-right corner
            let ur1 = (u - 0.8) * Math.cos(Math.PI/4) - (v - 0.2) * Math.sin(Math.PI/4);
            let vr1 = (u - 0.8) * Math.sin(Math.PI/4) + (v - 0.2) * Math.cos(Math.PI/4);
            let upperRightMain = Math.exp(-(ur1*ur1/0.002 + vr1*vr1/0.02));
            let upperRightDot = 0.5 * Math.exp(-((u-0.7)*(u-0.7)/0.001 + (v-0.1)*(v-0.1)/0.001));
            let upperRightBlob = upperRightMain + upperRightDot;
            
            // 2. Contiguous properly angled 'Z' shape strictly in the upper-left
            let d1 = distToSegmentSq(u, v, 0.15, 0.15, 0.35, 0.20); // Top bar (slight tilt)
            let d2 = distToSegmentSq(u, v, 0.35, 0.20, 0.15, 0.35); // Diagonal slash down
            let d3 = distToSegmentSq(u, v, 0.15, 0.35, 0.35, 0.40); // Bottom bar (slight tilt)
            let zShape = 0.9 * Math.exp(-Math.min(d1, d2, d3) / 0.001);
            
            return Math.max(0.001, upperRightBlob + zShape);
        }
        
        let baseTrueImgData = null;
        
        function renderTrueMap() {
            let imgData = trueCtx.createImageData(tw, th);
            for(let y=0; y<th; y++) {
                for(let x=0; x<tw; x++) {
                    let c = getDensity(x, y, tw, th);
                    let idx = (y*tw + x)*4;
                    let r = Math.floor(c * 255);
                    let g = Math.floor(c * 215);
                    let b = Math.floor(c * 50);
                    imgData.data[idx] = Math.max(20, r);
                    imgData.data[idx+1] = Math.max(20, g);
                    imgData.data[idx+2] = Math.max(30, b);
                    imgData.data[idx+3] = 255;
                }
            }
            trueCtx.putImageData(imgData, 0, 0);
            baseTrueImgData = trueCtx.getImageData(0, 0, tw, th);
        }
        renderTrueMap();
        
        let playing = false;
        let samples = 0;
        let accepted = 0;
        
        let cx = w/2;
        let cy = h/2;
        
        // Reconstruction Grid: 100x Higher Resolution (1x1 pixels instead of 10x10)
        const cellS = 1;
        let cols = Math.ceil(w / cellS);
        let rows = Math.ceil(h / cellS);
        let gridHits = new Array(cols * rows).fill(0);
        let maxHits = 1;
        
        let trace = []; // Store the trailing history
        
        function drawBackground() {
            ctx.fillStyle = '#141414';
            ctx.fillRect(0, 0, w, h);
            cx = w/2;
            cy = h/2;
            gridHits.fill(0);
            maxHits = 1;
            trace = [];
            if(baseTrueImgData) {
                trueCtx.putImageData(baseTrueImgData, 0, 0);
            }
        }
        
        drawBackground();
        
        function sample() {
            if(!playing) return;
            
            // Watch the walker move step by step
            for(let i=0; i<3; i++) { 
                let stepSize = parseFloat(document.getElementById('mh-step').value);
                
                let nx = cx + (Math.random() * 2 - 1) * stepSize;
                let ny = cy + (Math.random() * 2 - 1) * stepSize;
                
                if (nx < 0 || nx > w || ny < 0 || ny > h) {
                    samples++;
                    continue; 
                }
                
                let currGold = getDensity(cx, cy, w, h);
                let newGold = getDensity(nx, ny, w, h);
                
                let acceptRatio = newGold / currGold;
                samples++;
                
                let isAccepted = false;
                if (acceptRatio >= 1 || Math.random() < acceptRatio) {
                    isAccepted = true;
                }
                
                // Track trace history!
                trace.push({cx: cx, cy: cy, nx: nx, ny: ny, accepted: isAccepted});
                if(trace.length > 100) {
                    trace.shift();
                }
                
                if (isAccepted) {
                    cx = nx;
                    cy = ny;
                    accepted++;
                } 
                
                let gx = Math.floor(cx / cellS);
                let gy = Math.floor(cy / cellS);
                let gidx = gy * cols + gx;
                
                if(gx >= 0 && gx < cols && gy >= 0 && gy < rows) {
                    gridHits[gidx]++;
                    if(gridHits[gidx] > maxHits) {
                        maxHits = gridHits[gidx];
                    }
                }
            }
            
            redrawHeatmapAndTrace();
            
            let accRate = ((accepted / Math.max(1, samples))*100).toFixed(1);
            document.getElementById('mh-stats').innerText = `Samples: ${samples} | Acc: ${accepted} (${accRate}%)`;
            
            requestAnimationFrame(sample);
        }
        
        let lastRenderTime = 0;
        
        function redrawHeatmapAndTrace() {
            // Draw right canvas: The 1px resolution histogram
            let imgData = ctx.createImageData(w, h);
            for(let y=0; y<h; y++) {
                for(let x=0; x<w; x++) {
                    let gx = Math.floor(x / cellS);
                    let gy = Math.floor(y / cellS);
                    let val = gridHits[gy * cols + gx] / maxHits;
                    val = Math.pow(val, 0.4); 
                    
                    let idx = (y*w + x)*4;
                    imgData.data[idx] = Math.max(20, Math.floor(val * 255));
                    imgData.data[idx+1] = Math.max(20, Math.floor(val * 215));
                    imgData.data[idx+2] = Math.max(30, Math.floor(val * 50));
                    imgData.data[idx+3] = 255;
                }
            }
            ctx.putImageData(imgData, 0, 0);
            
            // Draw left canvas: Restore True map, then overlay the trace!
            if (baseTrueImgData) {
                trueCtx.putImageData(baseTrueImgData, 0, 0);
                
                for(let i=0; i<trace.length; i++) {
                    let t = trace[i];
                    trueCtx.beginPath();
                    trueCtx.moveTo(t.cx, t.cy);
                    trueCtx.lineTo(t.nx, t.ny);
                    if(t.accepted) {
                        trueCtx.strokeStyle = 'rgba(50, 255, 50, 0.7)'; // Green for walk
                        trueCtx.lineWidth = 1.5;
                    } else {
                        trueCtx.strokeStyle = 'rgba(255, 50, 50, 0.2)'; // Faint red reject line
                        trueCtx.lineWidth = 1.0;
                    }
                    trueCtx.stroke();
                    
                    // Small dot for jump end
                    trueCtx.beginPath();
                    trueCtx.arc(t.nx, t.ny, 1.5, 0, 2*Math.PI);
                    trueCtx.fillStyle = t.accepted ? 'gold' : 'rgba(255,50,50,0.4)';
                    trueCtx.fill();
                }
                
                // Draw current large active dot
                trueCtx.beginPath();
                trueCtx.arc(cx, cy, 4, 0, 2*Math.PI);
                trueCtx.fillStyle = 'white';
                trueCtx.fill();
                trueCtx.strokeStyle = 'black';
                trueCtx.lineWidth = 1;
                trueCtx.stroke();
            }
        }
        
        document.getElementById('mh-play').onclick = () => {
            playing = !playing;
            if(playing) sample();
        };
        
        document.getElementById('mh-reset').onclick = () => {
            playing = false;
            samples = 0;
            accepted = 0;
            document.getElementById('mh-stats').innerText = `Samples: 0 | Acc: 0`;
            drawBackground();
        };
        
    }, 500);
})();
