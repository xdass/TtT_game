const startGameBtn = document.querySelector('.startGameBtn');
const gamesList = document.querySelector('.gamesList');
const gameInfoText = document.querySelector('.gameInfo');
const gameField = document.querySelector('.gameField');
let socket = new WebSocket('ws://xo.t.javascript.ninja/games');
let isYourTurn = false;
let isError;
let gameId;
let playerId;
let playerSide;

socket.onopen = () => {
  console.log('Соединение установленно');
}
socket.onclose = (event) => {
  if (event.wasClean) {
    console.log('Соединение закрыто без ошибок');
  } else {
    console.log('Обрыв соединения');
    socket = new WebSocket('ws://xo.t.javascript.ninja/games');
    console.log('Переподключение..');
  }
}
socket.onmessage = (response) => {
  const data = JSON.parse(response.data);
  let action;
  if (data.error) {
    action = data.error;
  } else {
    action = data.action;
  }
  switch (action) {
    case 'add':
      addGameToList(data.id);
      break;
    case 'remove':
      removeGameFromList(data.id);
      break;
    case 'startGame':
      gameInfoText.innerText = 'Ожидаем начала игры...';
      startGameBtn.disabled = true;
      playerId = data.id;
      const options = {
        headers: {
          'Content-type': 'application/json; charset=utf-8'
        },
        method: 'POST',
        body: JSON.stringify({ player: playerId, game: gameId })
      }

      fetch('http://xo.t.javascript.ninja/gameReady', options)
        .then((response) => {
          switch (response.status) {
            case 410 :
              gameInfoText.innerText = 'Ошибка старта игры: другой игрок не ответил';
              break;
            case 200 :
              return response.json();
            default:
              gameInfoText.innerText = 'Неизвестная ошибка старта игры';
          }
        })
        .then(result => {
          playerSide = result.side;
          gameInfoText.innerText = `Вы играете за: ${playerSide}`;
          gamesList.style.display = 'none';
          gameField.style.display = 'table';
          createGameField(gameField);
          if (isTurn(playerSide)) {
            isYourTurn = true;
          } else {
            polling();
          }
        })
        .catch(error => {
          gameInfoText.innerText = `Ошибка${error}`;
          startGameBtn.disabled = false;
        });
      break;
    default:
      gameInfoText.innerText = action;
  }
};

function isTurn(side) {
  return side === 'x' ? true : false;
}

gamesList.addEventListener('click', (event) => {
  gameId = event.target.innerText;
  socket.send(JSON.stringify({ register: gameId }))
});

startGameBtn.addEventListener('click', () => {
  if (startGameBtn.innerText === 'Сдаться') {
    surrend();
  } else if (startGameBtn.innerText === 'Новая игра') {
    gameField.style.display = 'none';
    gamesList.style.display = 'table';
    gameInfoText.innerText = '';
    startGameBtn.innerText = 'Создать игру';
    startGameBtn.disabled = false;
    isError = false;
    clearGameField();
  } else {
    gameField.style.display = 'table';
    fetch('http://xo.t.javascript.ninja/newGame', {method: 'POST'} ) //создать игру
      .then(r => r.json())
      .then(id => {
        gameId = id.yourId;
        socket.send(JSON.stringify({ register: gameId })); //зарегестрироваться в созданнй игре
      })
      .catch((error) => {
        console.log(error);
        gameInfoText.innerText = 'Ошибка создания игры';
        startGameBtn.disabled = false;
      });
  }
});

gameField.addEventListener('click', (event) => {
  const cellNumber = parseInt(event.target.getAttribute('field'));
  const options = {
    headers: {
      'Accept' : '*/*',
      'Content-type': 'application/json; charset=utf-8',
      'Game-ID' : gameId,
      'Player-ID' : playerId
    },
    method: 'POST',
    body: JSON.stringify({ move: cellNumber })
  };

  if (isYourTurn && !isError) {
    fetch('http://xo.t.javascript.ninja/move', options)
      .then((response) => {
        return response.json();
      })
      .then((r) => {
        if (r.success) {
          if (r.win) {
            event.target.innerText = playerSide;
            gameInfoText.innerText = r.win;
            startGameBtn.innerText = 'Новая игра'
          } else {
            event.target.innerText = playerSide;
            isYourTurn = isYourTurn ? false : true;
            gameInfoText.innerText = 'Ход соперника';
            polling();
          }
        } else if (r.message) {
          gameInfoText.innerText = r.message;
        } else {
          gameInfoText.innerText = 'Неизвестная ошибка!';
        }
      })
      .catch((error) => {
        console.log(error.message);
        startGameBtn.innerText = 'Новая игра';
        startGameBtn.disabled = false;
      });
  }
});

function polling() {
  fetch('http://xo.t.javascript.ninja/move', {headers : {'Accept' : '*/*' ,'Game-ID' : gameId, 'Player-ID' : playerId}, method: 'GET'})
    .then(r => r.json())
    .then(response => {
      if (response.move) {
        const id = response.move;
        const opponentCell = gameField.querySelector(`td[field='${id}']`);
        if (response.win) {
          gameInfoText.innerText = response.win;
          startGameBtn.innerText = 'Новая игра';
          opponentCell.innerText = (playerSide === 'x') ? 'o' : 'x';
        } else {
          isYourTurn = true;
          opponentCell.innerText = (playerSide === 'x') ? 'o' : 'x';
          startGameBtn.innerText = 'Сдаться';
          gameInfoText.innerText = 'Сейчас ваш ход';
          startGameBtn.disabled = false;
        }
      } else if (response.win) {
        gameInfoText.innerText = response.win;
        startGameBtn.innerText = 'Новая игра';
        startGameBtn.disabled = false;
      } else {
        gameInfoText.innerText = response.message;
        startGameBtn.disabled = false;
        startGameBtn.innerText = 'Новая игра';
      }

    })
    .catch((error) => {
      gameInfoText.innerText = 'Неизвестная ошибка';
      console.log(error);
      polling();
    });
}

function surrend() {
  fetch('http://xo.t.javascript.ninja/surrender', {headers : {'Accept' : '*/*' ,'Game-ID' : gameId, 'Player-ID' : playerId}, method: 'PUT'})
    .then(response => response.json())
    .then(result => {
      if (result.success) {
        gameField.style.display = 'none';
        gamesList.style.display = 'table';
        startGameBtn.innerText = 'Создать игру';
        startGameBtn.disabled = false;
        gameInfoText.innerText = '';
        clearGameField();
      } else if (result.message) {
        gameInfoText.innerText = result.message;
        startGameBtn.disabled = false;
        startGameBtn.innerText = 'Новая игра';
        isError = true;
      } else {
        gameInfoText.innerText = 'Неизвестная ошибка';
        startGameBtn.innerText = 'Новая игра';
        isError = true;
      }
    })
    .catch(error => console.log(error));
}
function addGameToList (id) {
  const li = document.createElement('li');
  li.classList.add(id);
  li.innerText = id;
  gamesList.appendChild(li);
}
function removeGameFromList(gameId) {
  const itemToDelete = document.querySelector(`.${gameId}`)
  gamesList.removeChild(itemToDelete);
}
function createGameField(tag) {
  let idx = 1;
  let i;
  let j;
  for (i = 1; i < 11; i++) {
    const tr = document.createElement('tr');
    tag.appendChild(tr);
    for (j = 1; j < 11; j++) {
      const td = document.createElement('td');
      td.setAttribute('field', idx++);
      tr.appendChild(td);
    }
  }
}
function clearGameField() {
  while (gameField.children.length > 0) {
    gameField.removeChild(gameField.firstChild);
  }
}

// const startGameBtn = document.querySelector('.startGameBtn');
// const gamesList = document.querySelector('.gamesList');
// const gameInfoText = document.querySelector('.gameInfo');
// const gameField = document.querySelector('.gameField');
// let socket = new WebSocket('ws://xo.t.javascript.ninja/games');
// let isYourTurn = false;
// let isError;
// let gameId;
// let playerId;
// let playerSide;
//
// socket.onopen = () => {
//   console.log('Соединение установленно');
// }
// socket.onclose = (event) => {
//   if (event.wasClean) {
//     console.log('Соединение закрыто без ошибок');
//   } else {
//     console.log('Обрыв соединения');
//     socket = new WebSocket('ws://xo.t.javascript.ninja/games');
//     console.log('Переподключение..');
//   }
//   //console.log('Код: ' + event.code + ' причина: ' + event.reason )
// }
// socket.onmessage = (response) => {
//   let data = JSON.parse(response.data);
//   let action;
//   if (data.error) {
//     action = data.error;
//   } else {
//     action = data.action;
//   }
//   switch(action) {
//     case 'add':
//       addGameToList(data.id);
//       break;
//     case 'remove':
//       removeGameFromList(data.id);
//       break;
//     case 'startGame':
//       gameInfoText.innerText = 'Ожидаем начала игры...';
//       startGameBtn.disabled = true;
//       playerId = data.id;
//       let options = {
//         headers: {
//           'Content-type': 'application/json; charset=utf-8'
//         },
//         method: 'POST',
//         body: JSON.stringify({player: playerId, game: gameId})
//       }
//
//       fetch('http://xo.t.javascript.ninja/gameReady', options)
//         .then((response) => {
//           switch (response.status) {
//             case 410 :
//               gameInfoText.innerText = 'Ошибка старта игры: другой игрок не ответил';
//               break;
//             case 200 :
//               return response.json();
//             default:
//               gameInfoText.innerText = 'Неизвестная ошибка старта игры';
//               return;
//           }
//         })
//         .then(result => {
//           playerSide = result.side;
//           gameInfoText.innerText = `Вы играете за: ${playerSide}`;
//           gamesList.style.display = 'none';
//           gameField.style.display = 'table';
//           createGameField(gameField);
//           if (isTurn(playerSide)) {
//             isYourTurn = true;
//           } else {
//             polling();
//           }
//         })
//         .catch(error => {
//           gameInfoText.innerText = 'Ошибка' + error;
//           startGameBtn.disabled = false;
//         });
//       break;
//     default:
//       gameInfoText.innerText = action;
//   }
// }
//
// function isTurn(side) {
//   return side === 'x' ? true : false;
// }
//
// gamesList.addEventListener('click', (event) => {
//   gameId = event.target.innerText;
//   socket.send(JSON.stringify({register: gameId}))
// })
//
// startGameBtn.addEventListener('click', () => {
//   if (startGameBtn.innerText === 'Сдаться') {
//     surrend();
//   } else if (startGameBtn.innerText === 'Новая игра') {
//     gameField.style.display = 'none';
//     gamesList.style.display = 'table';
//     gameInfoText.innerText = '';
//     startGameBtn.innerText = 'Создать игру';
//     startGameBtn.disabled = false;
//     isError = false;
//     clearGameField();
//   } else {
//     gameField.style.display = 'table';
//     fetch('http://xo.t.javascript.ninja/newGame', {method: 'POST'} ) //создать игру
//       .then(r => r.json())
//       .then(id => {
//         gameId = id.yourId;
//         socket.send(JSON.stringify( {register: gameId} )); //зарегестрироваться в созданнй игре
//       })
//       .catch((error) => {
//         console.log(error);
//         gameInfoText.innerText = 'Ошибка создания игры';
//         startGameBtn.disabled = false;
//       });
//   }
// });
//
// gameField.addEventListener('click',(event) => {
//   let cellNumber;
//   cellNumber = parseInt(event.target.getAttribute('field'));
//   let options = {
//     headers: {
//       'Accept' : '*/*',
//       'Content-type': 'application/json; charset=utf-8',
//       'Game-ID' : gameId,
//       'Player-ID' : playerId
//     },
//     method: 'POST',
//     body: JSON.stringify({move : cellNumber})
//   }
//
//   if (isYourTurn && !isError) {
//     fetch('http://xo.t.javascript.ninja/move', options)
//       .then((response) => {
//         return response.json();
//       })
//       .then((r) => {
//         if (r.success) {
//           if (r.win) {
//             event.target.innerText = playerSide;
//             gameInfoText.innerText = r.win;
//             startGameBtn.innerText = 'Новая игра'
//           } else {
//             event.target.innerText = playerSide;
//             isYourTurn = isYourTurn ? false : true;
//             gameInfoText.innerText = 'Ход соперника';
//             polling();
//           }
//         } else if (r.message) {
//           gameInfoText.innerText = r.message;
//         } else {
//           gameInfoText.innerText = 'Неизвестная ошибка!';
//         }
//       })
//       .catch((error) => {
//         console.log(error.message);
//         startGameBtn.innerText = 'Новая игра';
//         startGameBtn.disabled = false;
//       })
//   }
// });
//
// function polling() {
//   fetch('http://xo.t.javascript.ninja/move', {headers : {'Accept' : '*/*' ,'Game-ID' : gameId, 'Player-ID' : playerId}, method: 'GET'})
//     .then(r => r.json())
//     .then(response => {
//       if (response.move) {
//         let id = response.move;
//         let opponentCell = gameField.querySelector(`td[field='${id}']`);
//         if (response.win) {
//           gameInfoText.innerText = response.win;
//           startGameBtn.innerText = 'Новая игра';
//           opponentCell.innerText = (playerSide === 'x') ? 'o' : 'x';
//         } else {
//           isYourTurn = true;
//           opponentCell.innerText = (playerSide === 'x') ? 'o' : 'x';
//           startGameBtn.innerText = 'Сдаться';
//           gameInfoText.innerText = 'Сейчас ваш ход'
//           startGameBtn.disabled = false;
//         }
//       } else if(response.win) {
//           gameInfoText.innerText = response.win;
//           startGameBtn.innerText = 'Новая игра';
//           startGameBtn.disabled = false;
//       } else {
//         gameInfoText.innerText = response.message;
//         startGameBtn.disabled = false;
//         startGameBtn.innerText = 'Новая игра';
//       }
//
//     })
//     .catch((error) => {
//       gameInfoText.innerText = 'Неизвестная ошибка';
//       console.log('Повторный Polling');
//       polling();
//     });
// }
//
// function surrend() {
//   fetch('http://xo.t.javascript.ninja/surrender', {headers : {'Accept' : '*/*' ,'Game-ID' : gameId, 'Player-ID' : playerId}, method: 'PUT'})
//     .then(response => response.json())
//     .then(result => {
//       if (result.success) {
//         gameField.style.display = 'none';
//         gamesList.style.display = 'table';
//         startGameBtn.innerText = 'Создать игру';
//         startGameBtn.disabled = false;
//         gameInfoText.innerText = '';
//         clearGameField();
//       } else if (result.message) {
//         gameInfoText.innerText = result.message;
//         startGameBtn.disabled = false;
//         startGameBtn.innerText = 'Новая игра';
//         isError = true;
//       } else {
//         gameInfoText.innerText = 'Неизвестная ошибка';
//         startGameBtn.innerText = 'Новая игра';
//         isError = true;
//       }
//     })
//     .catch(error => console.log(error));
// }
// function addGameToList(gameId) {
//   let li = document.createElement('li');
//   li.classList.add(gameId);
//   li.innerText = gameId;
//   gamesList.appendChild(li);
// }
// function removeGameFromList(gameId) {
//   let itemToDelete = document.querySelector(`.${gameId}`)
//   gamesList.removeChild(itemToDelete);
// }
// function createGameField(tag) {
//   let idx = 1;
//   for(i = 1; i < 11; i++) {
//     let tr = document.createElement('tr');
//     tag.appendChild(tr);
//     for(j = 1; j < 11; j++) {
//       let td = document.createElement('td');
//       td.setAttribute('field', idx++);
//       tr.appendChild(td);
//     }
//   }
// }
// function clearGameField() {
//   while (gameField.children.length > 0) {
//     gameField.removeChild(gameField.firstChild);
//   }
// }
