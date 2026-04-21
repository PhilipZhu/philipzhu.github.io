(function() {
    setTimeout(() => {
        const canvas = document.getElementById('bc-canvas');
        if(!canvas) return;
        
        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;
        
        const N_BINS = 200;
        let prior = new Float64Array(N_BINS);
        let posterior = new Float64Array(N_BINS);
        
        // UI Elements
        const truePSlider = document.getElementById('true-p-slider');
        const truePVal = document.getElementById('true-p-val');
        const speedSlider = document.getElementById('bc-speed');
        const statusDiv = document.getElementById('bc-status');
        const playBtn = document.getElementById('bc-play');
        const stepBtn = document.getElementById('bc-step');
        const resetBtn = document.getElementById('bc-reset');
        
        let isPlaying = false;
        let numWins = 0;
        let numLosses = 0;
        let rollHistory = []; // store last few rolls for display maybe
        let timerId = null;
        let lastRoll = null;
        
        let frozenMaxVal = 1;
        let currentScaleY = 1;
        let mouseX = 0;
        let mouseY = 0;
        
        // Initialize to Uniform
        function initUniform() {
            for(let i=0; i<N_BINS; i++) {
                prior[i] = 1.0;
            }
            normalize(prior);
            resetSimulation();
        }
        
        function normalize(arr) {
            let sum = 0;
            for(let i=0; i<N_BINS; i++) sum += arr[i];
            if (sum === 0) return; // avoid maxing out completely on zero
            for(let i=0; i<N_BINS; i++) arr[i] /= sum;
        }
        
        function resetSimulation() {
            isPlaying = false;
            clearTimeout(timerId);
            numWins = 0;
            numLosses = 0;
            rollHistory = [];
            lastRoll = null;
            // Copy prior to posterior
            for(let i=0; i<N_BINS; i++) {
                posterior[i] = prior[i];
            }
            updateStatusText(null);
            drawPlot();
        }
        
        function updateStatusText(lastRoll) {
            let total = numWins + numLosses;
            let winColor = (lastRoll === 'W') ? '#00ff00' : '#4a704a'; 
            let lossColor = (lastRoll === 'L') ? '#ff3333' : '#703a3a'; 
            
            let text = `Rolls: ${total} | <span style="color:${winColor}; font-weight:${lastRoll === 'W' ? 'bold' : 'normal'}">Wins: ${numWins}</span> | <span style="color:${lossColor}; font-weight:${lastRoll === 'L' ? 'bold' : 'normal'}">Losses: ${numLosses}</span>`;
            statusDiv.innerHTML = text;
        }
        
        // Step Simulation
        function simulateStep() {
            let trueP = parseFloat(truePSlider.value);
            let roll = (Math.random() < trueP) ? "W" : "L";
            lastRoll = roll;
            
            if(roll === "W") numWins++;
            else numLosses++;
            
            // Bayesian Update
            for(let i=0; i<N_BINS; i++) {
                let p = i / (N_BINS - 1);
                let likelihood = (roll === "W") ? p : (1 - p);
                posterior[i] = posterior[i] * likelihood;
            }
            normalize(posterior);
            
            updateStatusText(roll);
            drawPlot();
        }
        
        function loop() {
            if(!isPlaying) return;
            simulateStep();
            
            let delay = parseInt(speedSlider.value);
            timerId = setTimeout(loop, delay);
        }
        
        // Drawing Logic
        function drawPlot() {
            ctx.fillStyle = '#141414';
            ctx.fillRect(0, 0, w, h);
            
            let maxVal = 1;
            if (isDrawing) {
                maxVal = frozenMaxVal;
            } else {
                let maxPrior = 0;
                let maxPosterior = 0;
                for(let i=0; i<N_BINS; i++) {
                    if(prior[i] > maxPrior) maxPrior = prior[i];
                    if(posterior[i] > maxPosterior) maxPosterior = posterior[i];
                }
                maxVal = Math.max(maxPrior, maxPosterior);
                if (maxVal === 0) maxVal = 1;
                frozenMaxVal = maxVal;
            }
            
            // Add a little padding to the top (10%)
            currentScaleY = (h * 0.9) / maxVal;
            let scaleY = currentScaleY;
            
            // Draw horizontal Y-axis lines and ticks
            ctx.beginPath();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
            ctx.lineWidth = 1;
            let pd = (maxVal * N_BINS);
            for(let i=1; i<=4; i++) {
                let y = h - (h * 0.9) * (i/4);
                ctx.moveTo(0, y);
                ctx.lineTo(w, y);
                // Draw Y axis labels
                ctx.fillStyle = '#888';
                ctx.font = '10px Arial';
                ctx.fillText((pd * (i/4)).toFixed(1), 5, y - 4);
            }
            ctx.stroke();
            
            // Draw axes and grid
            ctx.strokeStyle = '#444';
            ctx.lineWidth = 1;
            ctx.beginPath();
            // Vertical lines for p=0.25, 0.5, 0.75
            for(let p of [0.25, 0.5, 0.75]) {
                let x = p * w;
                ctx.moveTo(x, 0);
                ctx.lineTo(x, h);
            }
            ctx.stroke();
            
            // Draw Likelihood if available
            if (lastRoll) {
                ctx.beginPath();
                if(lastRoll === "W") {
                    ctx.moveTo(0, h);
                    ctx.lineTo(w, h - (h * 0.9)); // scaled to 90%
                } else {
                    ctx.moveTo(0, h - (h * 0.9)); // scaled to 90%
                    ctx.lineTo(w, h);
                }
                ctx.strokeStyle = (lastRoll === "W") ? 'rgba(0, 255, 0, 0.3)' : 'rgba(255, 51, 51, 0.3)';
                ctx.lineWidth = 4;
                ctx.setLineDash([15, 10]);
                ctx.stroke();
                ctx.setLineDash([]);
                
                // Label Likelihood
                ctx.fillStyle = (lastRoll === "W") ? 'rgba(0, 255, 0, 0.5)' : 'rgba(255, 51, 51, 0.5)';
                ctx.font = 'bold 18px Arial';
                ctx.fillText(`Likelihood P(${lastRoll})`, w/2 + 20, (lastRoll === "W") ? h/2 + 40 : h/2 - 20);
            }
            
            // Helper to draw a curve
            function drawCurve(arr, color, isDashed=false) {
                ctx.beginPath();
                ctx.moveTo(0, h - arr[0]*scaleY);
                for(let i=1; i<N_BINS; i++) {
                    let x = (i / (N_BINS - 1)) * w;
                    let y = h - arr[i] * scaleY;
                    ctx.lineTo(x, y);
                }
                
                ctx.strokeStyle = color;
                ctx.lineWidth = isDashed ? 2 : 3;
                if(isDashed) ctx.setLineDash([5, 5]);
                else ctx.setLineDash([]);
                
                ctx.stroke();
                
                // Fill
                ctx.lineTo(w, h);
                ctx.lineTo(0, h);
                ctx.closePath();
                ctx.fillStyle = color;
                ctx.globalAlpha = isDashed ? 0.1 : 0.4;
                ctx.fill();
                ctx.globalAlpha = 1.0;
            }
            
            drawCurve(prior, '#aaaaaa', true); // Prior in dashed gray
            drawCurve(posterior, '#00e5ff', false); // Posterior in bright cyan
            
            // Draw True P vertical line
            let trueP = parseFloat(truePSlider.value);
            let tpX = trueP * w;
            ctx.beginPath();
            ctx.moveTo(tpX, 0);
            ctx.lineTo(tpX, h);
            ctx.strokeStyle = '#ffeb3b';
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 4]);
            ctx.stroke();
            ctx.setLineDash([]);
            
            // Peak label
            ctx.fillStyle = '#888';
            ctx.font = '12px Arial';
            ctx.fillText(`Peak Rel. Density: ~${pd.toFixed(1)}`, 5, 20);
            
            ctx.fillStyle = '#ffeb3b';
            ctx.font = '14px Arial';
            ctx.fillText('True p', tpX + 4, 35);
            
            if (isDrawing) {
                let effectiveY = mouseY;
                if (mouseY > h * 0.95) effectiveY = h;
                let tempVal = Math.max(0, (h - effectiveY) / currentScaleY);
                
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 14px Arial';
                ctx.fillText((tempVal * N_BINS).toFixed(2), mouseX + 15, mouseY - 15);
                
                ctx.beginPath();
                ctx.arc(mouseX, mouseY, 4, 0, Math.PI*2);
                ctx.fillStyle = '#ffeb3b';
                ctx.fill();
            }
        }
        
        // Interactive Drawing of Prior
        let isDrawing = false;
        let lastBin = -1;
        let minDrawnBin = N_BINS;
        let maxDrawnBin = -1;
        
        function getMousePos(evt) {
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            return {
                x: (evt.clientX - rect.left) * scaleX,
                y: (evt.clientY - rect.top) * scaleY
            };
        }
        
        function handleStroke(evt) {
            let pos = getMousePos(evt);
            mouseX = pos.x;
            mouseY = pos.y;
            
            let bin = Math.floor((pos.x / w) * N_BINS);
            bin = Math.max(0, Math.min(N_BINS - 1, bin));
            
            let effectiveY = pos.y;
            if (pos.y > h * 0.95) effectiveY = h;
            
            let val = Math.max(0, (h - effectiveY) / currentScaleY); 
            
            if(lastBin === -1) {
                prior[bin] = val;
                minDrawnBin = Math.min(minDrawnBin, bin);
                maxDrawnBin = Math.max(maxDrawnBin, bin);
            } else {
                // Interpolate
                let start = Math.min(lastBin, bin);
                let end = Math.max(lastBin, bin);
                for(let i=start; i<=end; i++) {
                    prior[i] = val; 
                }
                minDrawnBin = Math.min(minDrawnBin, start);
                maxDrawnBin = Math.max(maxDrawnBin, end);
            }
            
            // Instantly pad out the undrawn regions so it previews correctly during the drag itself
            if(minDrawnBin <= maxDrawnBin) {
                let leftVal = prior[minDrawnBin];
                let rightVal = prior[maxDrawnBin];
                for(let i=0; i<minDrawnBin; i++) prior[i] = leftVal;
                for(let i=maxDrawnBin+1; i<N_BINS; i++) prior[i] = rightVal;
            }
            
            lastBin = bin;
            drawPlot();
        }
        
        canvas.addEventListener('mousedown', (e) => {
            isDrawing = true;
            isPlaying = false; // pause sim
            clearTimeout(timerId);
            lastBin = -1;
            minDrawnBin = N_BINS;
            maxDrawnBin = -1;
            handleStroke(e);
        });
        
        canvas.addEventListener('mousemove', (e) => {
            if(!isDrawing) return;
            handleStroke(e);
        });
        
        function stopDrawing() {
            if(isDrawing) {
                isDrawing = false;
                if(minDrawnBin <= maxDrawnBin) {
                    // Carry endpoints outwards
                    let leftVal = prior[minDrawnBin];
                    let rightVal = prior[maxDrawnBin];
                    for(let i=0; i<minDrawnBin; i++) prior[i] = leftVal;
                    for(let i=maxDrawnBin+1; i<N_BINS; i++) prior[i] = rightVal;
                }
                normalize(prior);
                resetSimulation();
            }
        }
        
        canvas.addEventListener('mouseup', stopDrawing);
        canvas.addEventListener('mouseleave', stopDrawing);
        
        
        // Event Listeners
        truePSlider.addEventListener('input', (e) => {
            truePVal.innerText = parseFloat(e.target.value).toFixed(2);
            drawPlot();
        });
        
        playBtn.addEventListener('click', () => {
            isPlaying = !isPlaying;
            if(isPlaying) loop();
            else clearTimeout(timerId);
        });
        
        stepBtn.addEventListener('click', () => {
            isPlaying = false;
            clearTimeout(timerId);
            simulateStep();
        });
        
        resetBtn.addEventListener('click', () => {
            resetSimulation();
        });
        
        // Initialize
        initUniform();
        
    }, 500);
})();
