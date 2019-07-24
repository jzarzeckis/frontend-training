// Array (mutable) containing the todo items
const items = [
  {name: 'Watch JS tutorial', isDone: true},
  {name: 'Do JS exercises', isDone: false}
]

const form = document.getElementById('form');
const inputElement = document.getElementById('userInput');
const addButton = document.getElementById('enter');

const submitHandler = (inputElement, items, drawList) => (e) => {
  // Prevent browser from reloading the page;
  e.preventDefault();

  // Get the value of the name of the todo in input field
  const name = inputElement.value;
  // Don't add empty todos
  if (!name) return;
  const newItem = {
    name,
    isDone: false
  };
  items.push(newItem);
  // Re-render the list with the new state
  drawList();
  inputElement.value = "";
}

// Wheneve form submit event happens, we create and add a new item
form.addEventListener('submit', submitHandler(inputElement, items, drawList));

/**
 * A function called to render&reflect the new state of items in browser
 */
function drawList() {
  const list = document.getElementById('list');
  // Reset the list and make it empty
  list.innerHTML = "";

  for (const item of items) {
    const li = document.createElement('li')
    // Handle done/notDone toggling for every list item
    li.addEventListener('click', () => {
      item.isDone = !item.isDone
      li.className = item.isDone ? "done" : "";
    });
    // Set the proper class to indicate if item is done
    if (item.isDone) {
        li.className = 'done';
    }
    li.innerText = item.name;
    const btn = document.createElement('button');
    btn.innerText = "X";
    // Handle deleting todo items.
    btn.addEventListener('click', () => {
      items.splice(i, 1)
      drawList()
    })


    li.appendChild(btn);
    list.appendChild(li);
  }
}
drawList()