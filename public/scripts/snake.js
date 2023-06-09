/**
 * Script file for the hidden snake game.
 */

// Set up document element selectors
const playBoard = document.querySelector(".play-board");
const scoreElement = document.querySelector(".score");
const highScoreElement = document.querySelector(".high-score");
const controls = document.querySelectorAll(".controls i");

// Initialize the game variables
const GRID_SIZE = 30;
let gameOver = false;
let foodX, foodY;
let snakeX = 5,
  snakeY = 5;
let velocityX = 0,
  velocityY = 0;
let snakeBody = [];
let intervalId;
let score = 0;


/**
 * Changes the direction of the snake based on keyboard input.
 * 
 * @param {Object} event - the keyboard event object
 */
function changeDirection(event) {
  console.log(event)
  if (event.key === "ArrowUp" && velocityY != 1) {
    velocityX = 0;
    velocityY = -1;
  } else if (event.key === "ArrowDown" && velocityY != -1) {
    velocityX = 0;
    velocityY = 1;
  } else if (event.key === "ArrowLeft" && velocityX != 1) {
    velocityX = -1;
    velocityY = 0;
  } else if (event.key === "ArrowRight" && velocityX != -1) {
    velocityX = 1;
    velocityY = 0;
  }
};


// Add event listeners to change the direction on button click
controls.forEach((button) =>
  button.addEventListener("click", () =>
    changeDirection({ key: button.dataset.key })
  )
);


/**
 * Handles the game over situation.
 */
function handleGameOver() {
  clearInterval(intervalId);
  alert("Game Over! Press OK to replay...");
  location.reload();
};


// Get high score from local storage
let highScore = localStorage.getItem("high-score") || 0;
highScoreElement.innerText = `High Score: ${highScore}`;


/**
 * Updates the food's position to a random position on the game grid.
 */
function updateFoodPosition() {
  foodX = Math.floor(Math.random() * GRID_SIZE) + 1;
  foodY = Math.floor(Math.random() * GRID_SIZE) + 1;
};


/**
 * Initializes the game.
 */
function initGame() {
  if (gameOver) return handleGameOver();
  let html = `<div class="food" style="grid-area: ${foodY} / ${foodX}"></div>`;

  // Checking if the snake hit the food
  if (snakeX === foodX && snakeY === foodY) {
    updateFoodPosition();
    snakeBody.push([foodY, foodX]);
    score++;
    highScore = score >= highScore ? score : highScore;
    localStorage.setItem("high-score", highScore);
    scoreElement.innerText = `Score: ${score}`;
    highScoreElement.innerText = `High Score: ${highScore}`;
  }


  // Update the snake's head position based on the current velocity
  snakeX += velocityX;
  snakeY += velocityY;

  // Shift the values of the elements in the snake body by one
  for (let i = snakeBody.length - 1; i > 0; i--) {
    snakeBody[i] = snakeBody[i - 1];
  }

  // Set first element of snake body to current snake position
  snakeBody[0] = [snakeX, snakeY];

  // Check if the snake's moves past the wall, if so set gameOver to true
  if (snakeX <= 0 || snakeX > 30 || snakeY <= 0 || snakeY > 30) {
    return (gameOver = true);
  }

  // Add a div for each part of the snake's body
  for (let i = 0; i < snakeBody.length; i++) {
    html += `<div class="head" style="grid-area: ${snakeBody[i][1]} / ${snakeBody[i][0]}"></div>`;

    // Check if the snake head hit the body, if so set gameOver to true
    if (
      i !== 0 &&
      snakeBody[0][1] === snakeBody[i][1] &&
      snakeBody[0][0] === snakeBody[i][0]
    ) {
      gameOver = true;
    }
  }
  playBoard.innerHTML = html;
};

// Initialize the game, start on direction button release.
updateFoodPosition();
intervalId = setInterval(initGame, 130);
document.addEventListener("keyup", changeDirection);
