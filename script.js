class Minesweeper {
    constructor() {
        this.difficulties = {
            beginner: { rows: 9, cols: 9, mines: 10 },
            intermediate: { rows: 16, cols: 16, mines: 40 },
            expert: { rows: 16, cols: 30, mines: 99 }
        };
        
        this.currentDifficulty = 'beginner';
        this.board = [];
        this.gameOver = false;
        this.firstClick = true;
        this.timer = 0;
        this.timerInterval = null;
        this.remainingMines = 0;
        this.revealQueue = [];
        this.isRevealing = false;
        this.cheatsEnabled = false;
        this.isDarkTheme = localStorage.getItem('minesweeper-theme') === 'dark';
        
        // Initialize theme
        this.updateTheme(this.isDarkTheme);
        
        this.confetti = {
            particles: [],
            colors: ['#2196f3', '#4caf50', '#f44336', '#ffd700', '#9c27b0', '#00bcd4'],
            canvas: null,
            ctx: null,
            lastTime: 0,
            running: false
        };
        
        this.initializeGame();
        this.setupEventListeners();
        this.setupConfetti();
    }

    initializeGame() {
        const { rows, cols, mines } = this.difficulties[this.currentDifficulty];
        this.rows = rows;
        this.cols = cols;
        this.mines = mines;
        this.remainingMines = mines;
        this.gameOver = false;
        this.firstClick = true;
        this.revealQueue = [];
        this.isRevealing = false;
        
        // Update CSS variable for grid size
        document.documentElement.style.setProperty('--grid-size', cols);
        
        // Reset timer
        if (this.timerInterval) clearInterval(this.timerInterval);
        this.timer = 0;
        document.getElementById('timer').textContent = '0';
        
        // Update mine count
        document.getElementById('mine-count').textContent = this.remainingMines;
        
        // Create empty board
        this.board = Array(rows).fill().map(() => Array(cols).fill().map(() => ({
            isMine: false,
            isRevealed: false,
            isFlagged: false,
            neighborMines: 0
        })));
        
        // Create game board UI
        this.createBoard();
        
        const cheatBtn = document.getElementById('cheat-btn');
        if (cheatBtn) {
            cheatBtn.style.backgroundColor = '';
            cheatBtn.textContent = '👁️ Reveal Mines';
        }
    }

    createBoard() {
        const gameBoard = document.getElementById('game-board');
        gameBoard.style.gridTemplateColumns = `repeat(${this.cols}, var(--cell-size))`;
        gameBoard.innerHTML = '';
        
        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                const cell = document.createElement('button');
                cell.className = 'cell';
                cell.dataset.row = row;
                cell.dataset.col = col;
                gameBoard.appendChild(cell);
            }
        }
    }

    placeMines(firstRow, firstCol) {
        let minesPlaced = 0;
        while (minesPlaced < this.mines) {
            const row = Math.floor(Math.random() * this.rows);
            const col = Math.floor(Math.random() * this.cols);
            
            // Don't place mine on first click or where a mine already exists
            if ((row === firstRow && col === firstCol) || this.board[row][col].isMine) {
                continue;
            }
            
            this.board[row][col].isMine = true;
            minesPlaced++;
        }
        
        // Calculate neighbor mines
        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                if (!this.board[row][col].isMine) {
                    this.board[row][col].neighborMines = this.countNeighborMines(row, col);
                }
            }
        }
        
        // If cheats are enabled, show the mines
        if (this.cheatsEnabled) {
            for (let row = 0; row < this.rows; row++) {
                for (let col = 0; col < this.cols; col++) {
                    if (this.board[row][col].isMine) {
                        const cell = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
                        cell.classList.add('mine-revealed');
                    }
                }
            }
        }
    }

    countNeighborMines(row, col) {
        let count = 0;
        for (let i = -1; i <= 1; i++) {
            for (let j = -1; j <= 1; j++) {
                const newRow = row + i;
                const newCol = col + j;
                if (newRow >= 0 && newRow < this.rows && newCol >= 0 && newCol < this.cols) {
                    if (this.board[newRow][newCol].isMine) count++;
                }
            }
        }
        return count;
    }

    async revealCell(row, col) {
        if (this.board[row][col].isRevealed || this.board[row][col].isFlagged) return;
        
        const cell = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
        
        if (this.board[row][col].isMine) {
            this.board[row][col].isRevealed = true;
            cell.classList.add('mine');
            cell.textContent = '💣';
            this.gameOver = true;
            await this.revealAllMines();
            clearInterval(this.timerInterval);
            this.showGameOver();
            return;
        }
        
        // Create a batch of cells to reveal
        const cellsToReveal = [];
        const visited = new Set();
        
        const addCellToReveal = (r, c) => {
            const key = `${r},${c}`;
            if (visited.has(key)) return;
            visited.add(key);
            
            if (r >= 0 && r < this.rows && c >= 0 && c < this.cols && 
                !this.board[r][c].isRevealed && !this.board[r][c].isFlagged) {
                cellsToReveal.push({row: r, col: c});
                
                // If it's an empty cell, add its neighbors
                if (this.board[r][c].neighborMines === 0) {
                    for (let i = -1; i <= 1; i++) {
                        for (let j = -1; j <= 1; j++) {
                            addCellToReveal(r + i, c + j);
                        }
                    }
                }
            }
        };
        
        addCellToReveal(row, col);
        
        // Reveal all cells in the batch with staggered animation
        const revealWithAnimation = async () => {
            const delay = 30; // milliseconds between each cell reveal
            for (const {row, col} of cellsToReveal) {
                const cell = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
                this.board[row][col].isRevealed = true;
                
                // Add reveal animation class
                cell.classList.add('reveal-animation');
                cell.classList.add('revealed');
                
                if (this.board[row][col].neighborMines > 0) {
                    cell.textContent = this.board[row][col].neighborMines;
                    cell.dataset.number = this.board[row][col].neighborMines;
                }
                
                // Remove animation class after it completes
                cell.addEventListener('animationend', () => {
                    cell.classList.remove('reveal-animation');
                }, { once: true });
                
                await new Promise(resolve => setTimeout(resolve, delay));
            }
            
            // Check win condition after all animations complete
            if (this.checkWin()) {
                this.gameOver = true;
                clearInterval(this.timerInterval);
                this.showWin();
            }
        };
        
        await revealWithAnimation();
    }

    toggleFlag(row, col) {
        if (this.board[row][col].isRevealed) return;
        
        const cell = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
        this.board[row][col].isFlagged = !this.board[row][col].isFlagged;
        
        if (this.board[row][col].isFlagged) {
            cell.classList.add('flagged');
            cell.textContent = '🚩';
            this.remainingMines--;
        } else {
            cell.classList.remove('flagged');
            cell.textContent = '';
            this.remainingMines++;
        }
        
        document.getElementById('mine-count').textContent = this.remainingMines;
        
        // Check win condition
        if (this.checkWin()) {
            this.gameOver = true;
            clearInterval(this.timerInterval);
            this.showWin();
        }
    }

    async revealAllMines() {
        const cells = [];
        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                if (this.board[row][col].isMine) {
                    cells.push({ row, col });
                }
            }
        }
        
        // Reveal mines with animation
        for (const { row, col } of cells) {
            const cell = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
            cell.classList.add('mine');
            cell.textContent = '💣';
            await new Promise(resolve => setTimeout(resolve, 50));
        }
    }

    checkWin() {
        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                // Only check if non-mine cells are revealed
                if (!this.board[row][col].isMine && !this.board[row][col].isRevealed) {
                    return false;
                }
            }
        }
        return true;
    }

    startTimer() {
        this.timerInterval = setInterval(() => {
            this.timer++;
            document.getElementById('timer').textContent = this.timer;
        }, 1000);
    }

    showGameOver() {
        const gameContainer = document.querySelector('.game-container');
        gameContainer.style.animation = 'shake 0.5s ease-in-out';
        
        // Update game over screen stats
        document.getElementById('game-over-time').textContent = this.timer;
        document.getElementById('game-over-difficulty').textContent = this.currentDifficulty;
        
        // Show game over screen with delay
        setTimeout(() => {
            gameContainer.style.animation = '';
            const gameOverScreen = document.getElementById('game-over-screen');
            gameOverScreen.classList.add('show');
        }, 500);
    }

    setupConfetti() {
        this.confetti.canvas = document.getElementById('confetti-canvas');
        this.confetti.ctx = this.confetti.canvas.getContext('2d');
        
        const resizeCanvas = () => {
            this.confetti.canvas.width = window.innerWidth;
            this.confetti.canvas.height = window.innerHeight;
        };
        
        window.addEventListener('resize', resizeCanvas);
        resizeCanvas();
    }

    createConfettiParticle() {
        return {
            x: Math.random() * this.confetti.canvas.width,
            y: -20,
            size: Math.random() * 10 + 5,
            color: this.confetti.colors[Math.floor(Math.random() * this.confetti.colors.length)],
            speed: Math.random() * 3 + 2,
            angle: Math.random() * 360,
            rotation: Math.random() * 360,
            rotationSpeed: Math.random() * 2 - 1
        };
    }

    updateConfetti(timestamp) {
        if (!this.confetti.running) return;

        const deltaTime = timestamp - this.confetti.lastTime;
        this.confetti.lastTime = timestamp;

        this.confetti.ctx.clearRect(0, 0, this.confetti.canvas.width, this.confetti.canvas.height);

        // Add new particles
        if (this.confetti.particles.length < 100) {
            this.confetti.particles.push(this.createConfettiParticle());
        }

        // Update and draw particles
        this.confetti.particles = this.confetti.particles.filter(particle => {
            particle.y += particle.speed;
            particle.rotation += particle.rotationSpeed;

            this.confetti.ctx.save();
            this.confetti.ctx.translate(particle.x, particle.y);
            this.confetti.ctx.rotate((particle.rotation * Math.PI) / 180);
            this.confetti.ctx.fillStyle = particle.color;
            this.confetti.ctx.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size);
            this.confetti.ctx.restore();

            return particle.y < this.confetti.canvas.height + 20;
        });

        requestAnimationFrame(this.updateConfetti.bind(this));
    }

    startConfetti() {
        this.confetti.running = true;
        this.confetti.particles = [];
        this.confetti.lastTime = performance.now();
        requestAnimationFrame(this.updateConfetti.bind(this));
    }

    stopConfetti() {
        this.confetti.running = false;
        this.confetti.particles = [];
        this.confetti.ctx.clearRect(0, 0, this.confetti.canvas.width, this.confetti.canvas.height);
    }

    showWin() {
        const gameContainer = document.querySelector('.game-container');
        gameContainer.style.animation = 'celebrate 0.5s ease-in-out';
        
        // Update win screen stats
        document.getElementById('win-time').textContent = this.timer;
        document.getElementById('win-difficulty').textContent = this.currentDifficulty;
        
        // Show win screen with delay
        setTimeout(() => {
            gameContainer.style.animation = '';
            const winScreen = document.getElementById('win-screen');
            winScreen.classList.add('show');
            this.startConfetti();
        }, 500);
    }

    toggleCheats() {
        this.cheatsEnabled = !this.cheatsEnabled;
        const cheatBtn = document.getElementById('cheat-btn');
        
        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                if (this.board[row][col].isMine) {
                    const cell = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
                    if (this.cheatsEnabled) {
                        cell.classList.add('mine-revealed');
                    } else {
                        cell.classList.remove('mine-revealed');
                    }
                }
            }
        }
        
        // Update button appearance
        if (this.cheatsEnabled) {
            cheatBtn.style.backgroundColor = '#f44336';
            cheatBtn.textContent = '👁️ Hide Mines';
        } else {
            cheatBtn.style.backgroundColor = '';
            cheatBtn.textContent = '👁️ Reveal Mines';
        }
    }

    updateTheme(isDark) {
        document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
        const themeToggle = document.getElementById('theme-toggle');
        themeToggle.textContent = isDark ? '☀️' : '🌙';
        localStorage.setItem('minesweeper-theme', isDark ? 'dark' : 'light');
        this.isDarkTheme = isDark;
    }

    toggleTheme() {
        this.updateTheme(!this.isDarkTheme);
    }

    setupEventListeners() {
        // New game button
        document.getElementById('new-game').addEventListener('click', () => {
            this.initializeGame();
        });

        // Cheat button
        document.getElementById('cheat-btn').addEventListener('click', () => {
            this.toggleCheats();
        });

        // Difficulty buttons
        document.querySelectorAll('.difficulty-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.difficulty-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentDifficulty = btn.dataset.difficulty;
                this.initializeGame();
            });
        });

        // Game board clicks
        document.getElementById('game-board').addEventListener('click', (e) => {
            if (this.gameOver) return;
            
            const cell = e.target.closest('.cell');
            if (!cell) return;
            
            const row = parseInt(cell.dataset.row);
            const col = parseInt(cell.dataset.col);
            
            if (this.firstClick) {
                this.placeMines(row, col);
                this.startTimer();
                this.firstClick = false;
            }
            
            this.revealCell(row, col);
        });

        // Right click for flags
        document.getElementById('game-board').addEventListener('contextmenu', (e) => {
            e.preventDefault();
            if (this.gameOver) return;
            
            const cell = e.target.closest('.cell');
            if (!cell) return;
            
            const row = parseInt(cell.dataset.row);
            const col = parseInt(cell.dataset.col);
            
            this.toggleFlag(row, col);
        });

        // Play Again button (Win Screen)
        document.querySelector('.play-again-btn').addEventListener('click', () => {
            const winScreen = document.getElementById('win-screen');
            winScreen.classList.remove('show');
            this.stopConfetti();
            this.initializeGame();
        });

        // Try Again button (Game Over Screen)
        document.querySelector('.try-again-btn').addEventListener('click', () => {
            const gameOverScreen = document.getElementById('game-over-screen');
            gameOverScreen.classList.remove('show');
            this.initializeGame();
        });

        // Theme toggle button
        document.getElementById('theme-toggle').addEventListener('click', () => {
            this.toggleTheme();
        });
    }
}

// Initialize game when page loads
window.addEventListener('load', () => {
    new Minesweeper();
}); 