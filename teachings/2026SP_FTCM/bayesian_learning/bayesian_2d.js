(function() {
    setTimeout(() => {
        const postCanvas = document.getElementById('b2-post-canvas');
        const dataCanvas = document.getElementById('b2-data-canvas');
        if(!postCanvas || !dataCanvas) return;
        
        const postCtx = postCanvas.getContext('2d');
        const dataCtx = dataCanvas.getContext('2d');
        const pw = postCanvas.width;
        const ph = postCanvas.height;
        const dw = dataCanvas.width;
        const dh = dataCanvas.height;
        
        // Grid setup
        const M_BINS = 100; // mu
        const S_BINS = 60;  // sigma
        let posterior = new Float64Array(M_BINS * S_BINS);
        
        let dataList = [];
        let simList = [];
        
        let isPlaying = false;
        let numPoints = 0;
        
        function rnorm(mean, stdev) {
            let u1 = 1 - Math.random(); 
            let u2 = 1 - Math.random();
            let randStdNormal = Math.sqrt(-2.0 * Math.log(u1)) * Math.sin(2.0 * Math.PI * u2);
            return mean + stdev * randStdNormal;
        }
        
        function initPrior() {
            for(let j=0; j<S_BINS; j++) {
                let sig = 1 + j * (60 / S_BINS); // 1 to 61
                for(let i=0; i<M_BINS; i++) {
                    let mu = 130 + i * (100 / M_BINS); // 130 to 230
                    let p_mu = Math.exp(-0.5 * Math.pow((mu - 178)/20, 2));
                    let p_sig = Math.exp(-sig / 50.0);
                    posterior[j * M_BINS + i] = p_mu * p_sig;
                }
            }
            normalize(posterior);
            
            dataList = [];
            simList = [];
            numPoints = 0;
            updateStatus();
            drawGrid();
            drawData();
        }
        
        function normalize(arr) {
            let sum = 0;
            for(let i=0; i<arr.length; i++) sum += arr[i];
            if(sum === 0) return;
            for(let i=0; i<arr.length; i++) arr[i] /= sum;
        }
        
        function simulatePoint() {
            let mode = document.getElementById('b2-data-mode').value;
            let u1 = parseFloat(document.getElementById('b2-u1-slider').value);
            let s1 = parseFloat(document.getElementById('b2-s1-slider').value);
            
            let y_true = 0;
            if(mode === 'normal') {
                y_true = rnorm(u1, s1);
            } else {
                let u2 = parseFloat(document.getElementById('b2-u2-slider').value);
                let s2 = parseFloat(document.getElementById('b2-s2-slider').value);
                if(Math.random() < 0.5) y_true = rnorm(u1, s1);
                else y_true = rnorm(u2, s2);
            }
            dataList.push(y_true);
            numPoints++;
            
            // Update Posterior
            for(let j=0; j<S_BINS; j++) {
                let sig = 1 + j * (60 / S_BINS); 
                for(let i=0; i<M_BINS; i++) {
                    let mu = 130 + i * (100 / M_BINS);
                    let L = (1.0 / sig) * Math.exp(-0.5 * Math.pow((y_true - mu)/sig, 2));
                    posterior[j * M_BINS + i] *= L;
                }
            }
            normalize(posterior);
            
            updateStatus();
            // Don't draw every single frame if playing fast, but rAF speed makes it okay.
            drawGrid();
            drawData();
        }
        
        function samplePosterior() {
            simList = [];
            let nSamples = Math.max(1000, dataList.length);
            for(let loop = 0; loop < nSamples; loop++) {
                let r = Math.random();
                let cdf = 0;
                let k = 0;
                for(; k < M_BINS * S_BINS; k++) {
                    cdf += posterior[k];
                    if (cdf >= r) break;
                }
                if (k >= M_BINS * S_BINS) k = M_BINS * S_BINS - 1;
                
                let i = k % M_BINS;
                let j = Math.floor(k / M_BINS);
                let mu_samp = 130 + i * (100 / M_BINS);
                let sig_samp = 1 + j * (60 / S_BINS);
                
                let y_sim = rnorm(mu_samp, sig_samp);
                simList.push(y_sim);
            }
            drawData();
        }
        
        function updateStatus() {
            document.getElementById('b2-status').innerText = `Data Points (N): ${numPoints}`;
        }
        
        function drawGrid() {
            postCtx.clearRect(0, 0, pw, ph);
            let maxP = 0;
            for(let k=0; k<posterior.length; k++) {
                if(posterior[k] > maxP) maxP = posterior[k];
            }
            if(maxP === 0) maxP = 1;
            
            let cellW = pw / M_BINS;
            let cellH = ph / S_BINS;
            
            for(let j=0; j<S_BINS; j++) {
                // To make Y axis grow upwards, y_draw is inverted
                let y = ph - (j + 1) * cellH;
                for(let i=0; i<M_BINS; i++) {
                    let x = i * cellW;
                    let val = posterior[j * M_BINS + i] / maxP;
                    
                    let intensity = Math.pow(val, 0.5); // gamma correction for better visibility
                    let r = Math.floor(intensity * 255);
                    let g = Math.floor(intensity * 200);
                    let b = Math.floor(intensity * 50);
                    
                    postCtx.fillStyle = `rgb(${r}, ${g}, ${b})`;
                    postCtx.fillRect(x, y, cellW+0.5, cellH+0.5);
                }
            }
            
            // Axes overlays
            postCtx.fillStyle = 'rgba(255,255,255,0.7)';
            postCtx.font = 'bold 12px Arial';
            postCtx.fillText('μ = 130', 5, ph - 5);
            postCtx.fillText('μ = 230', pw - 50, ph - 5);
            postCtx.fillText('σ = 60', 5, 15);
            postCtx.fillText('σ = 1', 5, ph - 15);
        }
        
        function drawData() {
            dataCtx.clearRect(0, 0, dw, dh);
            
            let minVal = 100;
            let maxVal = 260;
            let BINS = 60;
            let binW = dw / BINS;
            let binWidth_units = (maxVal - minVal) / BINS;
            
            let dataHist = new Array(BINS).fill(0);
            for(let v of dataList) {
                let idx = Math.floor((v - minVal) / (maxVal - minVal) * BINS);
                if(idx >= 0 && idx < BINS) dataHist[idx]++;
            }
            
            let simHist = new Array(BINS).fill(0);
            for(let v of simList) {
                let idx = Math.floor((v - minVal) / (maxVal - minVal) * BINS);
                if(idx >= 0 && idx < BINS) simHist[idx]++;
            }
            
            let mode = document.getElementById('b2-data-mode').value;
            let u1 = parseFloat(document.getElementById('b2-u1-slider').value);
            let s1 = parseFloat(document.getElementById('b2-s1-slider').value);
            let u2 = document.getElementById('b2-u2-slider') ? parseFloat(document.getElementById('b2-u2-slider').value) : 210;
            let s2 = document.getElementById('b2-s2-slider') ? parseFloat(document.getElementById('b2-s2-slider').value) : 15;
            
            function pdf(x) {
                if(mode === 'normal') {
                    return (1 / (s1 * Math.sqrt(2*Math.PI))) * Math.exp(-0.5 * Math.pow((x - u1)/s1, 2));
                } else {
                    let p1 = (1 / (s1 * Math.sqrt(2*Math.PI))) * Math.exp(-0.5 * Math.pow((x - u1)/s1, 2));
                    let p2 = (1 / (s2 * Math.sqrt(2*Math.PI))) * Math.exp(-0.5 * Math.pow((x - u2)/s2, 2));
                    return 0.5 * p1 + 0.5 * p2;
                }
            }
            
            let maxPdf = Math.max(pdf(u1), mode === 'bimodal' ? pdf(u2) : 0);
            if(maxPdf < 0.001) maxPdf = 0.05; 
            
            // Empirical Density processing
            let maxBlueDensity = 0;
            if(dataList.length > 0) {
                for(let i=0; i<BINS; i++) {
                    let d = dataHist[i] / (dataList.length * binWidth_units);
                    if(d > maxBlueDensity) maxBlueDensity = d;
                }
            }
            
            let maxRedDensity = 0;
            if(simList.length > 0) {
                for(let i=0; i<BINS; i++) {
                    let d = simHist[i] / (simList.length * binWidth_units);
                    if(d > maxRedDensity) maxRedDensity = d;
                }
            }
            
            // Decoupled denominators tracking against static curve!
            let blueDenom = Math.max(maxPdf, maxBlueDensity);
            if(blueDenom === 0) blueDenom = maxPdf;
            
            let redDenom = Math.max(maxPdf, maxRedDensity);
            if(redDenom === 0) redDenom = maxPdf;
            
            // 0. Draw Empirical True Data Histogram (Blue)
            dataCtx.fillStyle = 'rgba(33, 150, 243, 0.4)';
            if(dataList.length > 0) {
                for(let i=0; i<BINS; i++) {
                    if(dataHist[i] === 0) continue;
                    let empirical_density = dataHist[i] / (dataList.length * binWidth_units);
                    let h_px = (empirical_density / blueDenom) * (dh * 0.85);
                    let x = i * binW;
                    let y = dh - h_px;
                    dataCtx.fillRect(x, y, binW * 0.9, h_px);
                }
            }
            
            // 1. Draw Posterior Predictive histogram (Red)
            dataCtx.fillStyle = 'rgba(244, 67, 54, 0.7)';
            if(simList.length > 0) {
                for(let i=0; i<BINS; i++) {
                    if(simHist[i] === 0) continue;
                    let empirical_density = simHist[i] / (simList.length * binWidth_units);
                    let h_px = (empirical_density / redDenom) * (dh * 0.85);
                    let x = i * binW;
                    let y = dh - h_px;
                    dataCtx.fillRect(x, y, binW * 0.9, h_px);
                }
            }
            
            // 2. Draw True Generative Distribution Curve (Mathematical PDF Overlay)
            // It uses ONLY maxPdf, keeping it 100% static in height!
            dataCtx.beginPath();
            dataCtx.moveTo(0, dh);
            for(let x_px = 0; x_px <= dw; x_px += 2) {
                let x_val = minVal + (x_px / dw) * (maxVal - minVal);
                let y_val = pdf(x_val);
                let h_px = (y_val / maxPdf) * (dh * 0.85);
                
                let y_px = dh - h_px;
                dataCtx.lineTo(x_px, y_px);
            }
            dataCtx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
            dataCtx.lineWidth = 3;
            dataCtx.setLineDash([5, 5]);
            dataCtx.stroke();
            dataCtx.setLineDash([]);
            
            // Legend
            dataCtx.fillStyle = 'rgba(33, 150, 243, 0.8)';
            dataCtx.fillRect(10, 10, 15, 10);
            dataCtx.fillStyle = 'white';
            dataCtx.font = '12px Arial';
            dataCtx.fillText('Empirical True Data (Histogram)', 30, 20);
            
            dataCtx.fillStyle = 'rgba(244, 67, 54, 0.8)';
            dataCtx.fillRect(10, 26, 15, 10);
            dataCtx.fillStyle = 'white';
            dataCtx.fillText('Posterior Predictive (Histogram)', 30, 36);
            
            dataCtx.beginPath();
            dataCtx.moveTo(10, 47);
            dataCtx.lineTo(25, 47);
            dataCtx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
            dataCtx.lineWidth = 2;
            dataCtx.setLineDash([3, 3]);
            dataCtx.stroke();
            dataCtx.setLineDash([]);
            dataCtx.fillStyle = 'white';
            dataCtx.fillText('True Generative Curve (Static)', 30, 51);
        }
        
        function loop() {
            if(!isPlaying) return;
            // Step multiple times per frame for faster accumulation
            for(let k=0; k<5; k++) {
                 simulatePoint();
            }
            requestAnimationFrame(loop);
        }
        
        document.getElementById('b2-play').addEventListener('click', () => {
            isPlaying = !isPlaying;
            if(isPlaying) loop();
        });
        
        document.getElementById('b2-step').addEventListener('click', () => {
            isPlaying = false;
            simulatePoint();
        });
        
        document.getElementById('b2-sample').addEventListener('click', () => {
            isPlaying = false; // Optional: pause training while sampling manually
            samplePosterior();
        });
        
        document.getElementById('b2-reset').addEventListener('click', () => {
            isPlaying = false;
            initPrior();
        });
        
        // Mode switch
        document.getElementById('b2-data-mode').addEventListener('change', (e) => {
            if(e.target.value === 'normal') {
                document.getElementById('b2-bimodal-params').style.display = 'none';
            } else {
                document.getElementById('b2-bimodal-params').style.display = 'flex';
            }
            drawData(); // refresh theoretical curve
        });
        
        // Bind slider text outputs and force dynamic draw
        let sliders = ['u1', 's1', 'u2', 's2'];
        sliders.forEach(id => {
            let el = document.getElementById('b2-' + id + '-slider');
            if(el) {
                el.addEventListener('input', (e) => {
                    document.getElementById('b2-' + id + '-val').innerText = e.target.value;
                    drawData(); // live curve update
                });
            }
        });
        
        // Interactive Prior/Posterior Drawing
        let isDrawingGrid = false;
        
        function handleGridDraw(e) {
            let rect = postCanvas.getBoundingClientRect();
            let x = e.clientX - rect.left;
            let y = e.clientY - rect.top;
            
            let cellW = pw / M_BINS;
            let cellH = ph / S_BINS;
            
            let i = Math.floor(x / cellW);
            let j = Math.floor((ph - y) / cellH);
            
            if(i < 0) i = 0; if(i >= M_BINS) i = M_BINS - 1;
            if(j < 0) j = 0; if(j >= S_BINS) j = S_BINS - 1;
            
            let maxP = 0;
            for(let k=0; k<posterior.length; k++) {
                if(posterior[k] > maxP) maxP = posterior[k];
            }
            if(maxP === 0) maxP = 1;
            
            let brushWeight = maxP * 0.05; // Drop significantly slower
            let brushRadiusX = 8; // Larger X radius
            let brushRadiusY = 5; // Larger Y radius
            
            for(let jj = Math.max(0, j - 15); jj <= Math.min(S_BINS-1, j + 15); jj++) {
                for(let ii = Math.max(0, i - 15); ii <= Math.min(M_BINS-1, i + 15); ii++) {
                    let d2 = Math.pow((ii - i)/brushRadiusX, 2) + Math.pow((jj - j)/brushRadiusY, 2);
                    let val = brushWeight * Math.exp(-0.5 * d2);
                    posterior[jj * M_BINS + ii] += val;
                }
            }
            normalize(posterior);
            drawGrid();
        }
        
        postCanvas.addEventListener('mousedown', (e) => {
            isDrawingGrid = true;
            handleGridDraw(e);
        });
        postCanvas.addEventListener('mousemove', (e) => {
            if(isDrawingGrid) handleGridDraw(e);
        });
        postCanvas.addEventListener('mouseup', () => { isDrawingGrid = false; });
        postCanvas.addEventListener('mouseleave', () => { isDrawingGrid = false; });
        
        initPrior();
        
    }, 500);
})();
