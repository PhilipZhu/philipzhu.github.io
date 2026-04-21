(function() {
    setTimeout(() => {
        const canvas = document.getElementById('naive-canvas');
        const trueCanvas = document.getElementById('naive-true');
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
            
            return Math.max(0, upperRightBlob + zShape);
        }
        
        let baseTrueImgData = null;
        
        // Render the True Density Map
        function renderTrueMap() {
            let imgData = trueCtx.createImageData(tw, th);
            for(let y=0; y<th; y++) {
                for(let x=0; x<tw; x++) {
                    let c = getDensity(x, y, tw, th);
                    let idx = (y*tw + x)*4;
                    // Dark background to Gold colormap
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
        
        // Reconstruction Grid (Resolution 1x1 highest high definition)
        const cellS = 1;
        let cols = Math.ceil(w / cellS);
        let rows = Math.ceil(h / cellS);
        let gridSum = new Array(cols * rows).fill(0);
        let gridCount = new Array(cols * rows).fill(0);
        
        let trace = []; 
        
        function drawBackground() {
            ctx.fillStyle = '#141414';
            ctx.fillRect(0, 0, w, h);
            gridSum.fill(0);
            gridCount.fill(0);
            trace = [];
            if(baseTrueImgData) {
                trueCtx.putImageData(baseTrueImgData, 0, 0);
            }
        }
        
        drawBackground();
        
        function sample() {
            if(!playing) return;
            
            for(let i=0; i<20; i++) { 
                let x = Math.random() * w;
                let y = Math.random() * h;
                
                // Sample the true density
                let c = getDensity(x, y, w, h);
                
                let gx = Math.floor(x / cellS);
                let gy = Math.floor(y / cellS);
                let gidx = gy * cols + gx;
                
                if (gx>=0 && gx<cols && gy>=0 && gy<rows) {
                    gridSum[gidx] += c;
                    gridCount[gidx]++;
                    samples++;
                    
                    // Immediately update that exact pixel on reconstructed map
                    let avg = gridSum[gidx] / gridCount[gidx];
                    let r = Math.floor(avg * 255);
                    let g = Math.floor(avg * 215);
                    let b = Math.floor(avg * 50);
                    
                    ctx.fillStyle = `rgb(${r+20}, ${g+20}, ${b+30})`;
                    ctx.fillRect(gx * cellS, gy * cellS, cellS, cellS);
                }
                
                trace.push({x: x, y: y});
                if(trace.length > 200) { // Keep last 200 drops
                    trace.shift();
                }
            }
            
            document.getElementById('naive-stats').innerText = `Samples: ${samples}`;
            
            // Draw drops trace on true map
            if (baseTrueImgData) {
                trueCtx.putImageData(baseTrueImgData, 0, 0);
                trueCtx.fillStyle = 'rgba(255, 255, 255, 0.8)';
                for(let i=0; i<trace.length; i++) {
                    trueCtx.beginPath();
                    trueCtx.arc(trace[i].x, trace[i].y, 2, 0, 2*Math.PI);
                    trueCtx.fill();
                }
            }
            
            requestAnimationFrame(sample);
        }
        
        document.getElementById('naive-play').onclick = () => {
            playing = !playing;
            if(playing) sample();
        };
        
        document.getElementById('naive-reset').onclick = () => {
            playing = false;
            samples = 0;
            document.getElementById('naive-stats').innerText = `Samples: 0`;
            drawBackground();
        };
        
    }, 500); 
})();
