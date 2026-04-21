(function() {
    setTimeout(() => {
        const priorCanvas = document.getElementById('b3-prior-canvas');
        const likeCanvas = document.getElementById('b3-like-canvas');
        const postCanvas = document.getElementById('b3-post-canvas');
        if(!priorCanvas || !likeCanvas || !postCanvas) return;
        
        const priorCtx = priorCanvas.getContext('2d');
        const likeCtx = likeCanvas.getContext('2d');
        const postCtx = postCanvas.getContext('2d');
        
        const pw = priorCanvas.width;
        const ph = priorCanvas.height;
        const BINS = 140;
        
        let prior = new Float64Array(BINS * BINS);
        let likelihood = new Float64Array(BINS * BINS);
        let posterior = new Float64Array(BINS * BINS);
        
        function normalize(arr) {
            let sum = 0;
            for(let i=0; i<arr.length; i++) sum += arr[i];
            if(sum === 0) return;
            for(let i=0; i<arr.length; i++) arr[i] /= sum;
        }
        
        function initLikelihood() {
            // Highly collinear likelihood: tight along beta1 + beta2 = 0
            let sTight = 0.5;
            let sLoose = 6.0;
            for(let j=0; j<BINS; j++) {
                let b2 = 5 - j * (10 / BINS);
                for(let i=0; i<BINS; i++) {
                    let b1 = -5 + i * (10 / BINS);
                    
                    let tightComp = Math.pow(b1 + b2, 2) / (2 * sTight * sTight);
                    let looseComp = Math.pow(b1 - b2, 2) / (2 * sLoose * sLoose);
                    
                    likelihood[j * BINS + i] = Math.exp(-tightComp - looseComp);
                }
            }
        }
        
        function initPrior() {
            // Start uniform flat
            for(let k=0; k<prior.length; k++) prior[k] = 1.0;
            normalize(prior);
            updatePosterior();
            drawAll();
        }
        
        function updatePosterior() {
            for(let k=0; k<posterior.length; k++) {
                posterior[k] = prior[k] * likelihood[k];
            }
            normalize(posterior);
        }
        
        function drawHeatmap(ctx, arr, colorMode) {
            ctx.clearRect(0, 0, pw, ph);
            let maxP = 0;
            for(let k=0; k<arr.length; k++) {
                if(arr[k] > maxP) maxP = arr[k];
            }
            if(maxP === 0) maxP = 1;
            
            let cellW = pw / BINS;
            let cellH = ph / BINS;
            
            for(let j=0; j<BINS; j++) {
                let y = j * cellH;
                for(let i=0; i<BINS; i++) {
                    let x = i * cellW;
                    let val = arr[j * BINS + i] / maxP;
                    
                    if(colorMode === 'dark') {
                        let intensity = Math.pow(val, 0.5); 
                        let r = Math.floor(intensity * 255);
                        let g = Math.floor(intensity * 200);
                        let b = Math.floor(intensity * 50);
                        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
                        ctx.fillRect(x, y, cellW+0.5, cellH+0.5);
                    } else if(colorMode === 'contour') {
                        let levels = 3; // Ultra wide spacing
                        let intensity = val * levels;
                        let distToContour = Math.abs(intensity - Math.round(intensity));
                        
                        // Anti-aliased smooth contour line drawing using grayscale gradients
                        let contourStrength = Math.max(0, 1.0 - (distToContour / 0.15));
                        let valStrength = Math.min(1.0, val * 10); // Fade out contours near 0 probability
                        
                        let gray = Math.floor(255 * (1.0 - (contourStrength * valStrength)));
                        ctx.fillStyle = `rgb(${gray}, ${gray}, ${gray})`;
                        ctx.fillRect(x, y, cellW+0.5, cellH+0.5);
                    }
                }
            }
            
            // Axes overlays
            let fontColor = colorMode === 'dark' ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)';
            ctx.fillStyle = fontColor;
            ctx.font = 'bold 12px Arial';
            ctx.fillText('β1', pw - 20, ph / 2 - 5);
            ctx.fillText('β2', 5, 15);
            
            // Draw axis lines
            ctx.beginPath();
            ctx.moveTo(0, ph/2); ctx.lineTo(pw, ph/2);
            ctx.moveTo(pw/2, 0); ctx.lineTo(pw/2, ph);
            ctx.strokeStyle = colorMode === 'dark' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)';
            ctx.lineWidth = 1;
            ctx.stroke();
        }
        
        function drawAll() {
            drawHeatmap(priorCtx, prior, 'dark');
            drawHeatmap(likeCtx, likelihood, 'contour');
            drawHeatmap(postCtx, posterior, 'dark');
        }
        
        // Interactive Drawing on Prior
        let isDrawing = false;
        let needsRedraw = false;
        
        function renderLoop() {
            if(needsRedraw) {
                drawHeatmap(priorCtx, prior, 'dark');
                drawHeatmap(postCtx, posterior, 'dark');
                needsRedraw = false;
            }
            requestAnimationFrame(renderLoop);
        }
        requestAnimationFrame(renderLoop);
        
        function handleDraw(e) {
            let rect = priorCanvas.getBoundingClientRect();
            let x = e.clientX - rect.left;
            let y = e.clientY - rect.top;
            
            let cellW = pw / BINS;
            let cellH = ph / BINS;
            
            let i = Math.floor(x / cellW);
            let j = Math.floor(y / cellH);
            
            if(i < 0) i = 0; if(i >= BINS) i = BINS - 1;
            if(j < 0) j = 0; if(j >= BINS) j = BINS - 1;
            
            let maxP = 0;
            for(let k=0; k<prior.length; k++) {
                if(prior[k] > maxP) maxP = prior[k];
            }
            if(maxP === 0) maxP = 1;
            
            let brushWeight = maxP * 0.1; // Moderate drop rate
            let brushRadiusX = 8; 
            let brushRadiusY = 8; 
            
            for(let jj = Math.max(0, j - 20); jj <= Math.min(BINS-1, j + 20); jj++) {
                for(let ii = Math.max(0, i - 20); ii <= Math.min(BINS-1, i + 20); ii++) {
                    let d2 = Math.pow((ii - i)/brushRadiusX, 2) + Math.pow((jj - j)/brushRadiusY, 2);
                    let val = brushWeight * Math.exp(-0.5 * d2);
                    prior[jj * BINS + ii] += val;
                }
            }
            normalize(prior);
            updatePosterior();
            needsRedraw = true;
        }
        
        priorCanvas.addEventListener('mousedown', (e) => {
            isDrawing = true;
            handleDraw(e);
        });
        priorCanvas.addEventListener('mousemove', (e) => { // Fixed loop
            if(isDrawing) handleDraw(e);
        });
        priorCanvas.addEventListener('mouseup', () => { isDrawing = false; });
        priorCanvas.addEventListener('mouseleave', () => { isDrawing = false; });
        
        priorCanvas.addEventListener('dblclick', () => {
            isDrawing = false;
            initPrior();
        });
        
        initLikelihood();
        initPrior();
        
    }, 500);
})();
