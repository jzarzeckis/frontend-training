const app = document.getElementById("app");

let activePlayer = "O";

function changePlayer() {
  activePlayer = activePlayer === "O" ? "X" : "O";
}

const grid = [...app.querySelectorAll("td")]
  .map((element, index) => ({
    element,
    index,
    value: ""
  })
);

function hasPlayerWon(grid, player) {
  const rows = [0, 1, 2];
  const columns = [0, 1, 2];
  // Iterate through all rows
  if (rows.some(row =>
    columns.every(cellId =>
      grid[row * 3 + cellId].value === player))) return true;
  // Iterate through all columns
  if (columns.some(cellId =>
    rows.every(row =>
      grid[row * 3 + cellId].value === player))) return true;
  // Diagonal
  if (rows.every(id => grid[id * 3 + id].value === player)) return true;
  // Other Diagonal
  if (rows.every(id => grid[id * 3 + 2 - id].value === player)) return true;
  
  return false;
}

for (const cell of grid) {
  cell.element.addEventListener('click', (e) => {
    e.preventDefault();
    if (cell.value) return;
    cell.element.innerText = activePlayer;
    cell.value = activePlayer;
    if (hasPlayerWon(grid, activePlayer)) {
      alert(`Player ${activePlayer} wins!`);
    }
    changePlayer();
  });
}