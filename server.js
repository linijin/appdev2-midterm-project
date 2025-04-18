const http = require('http');
const fs = require('fs');
const url = require('url');
const { EventEmitter } = require('events');
const PORT = 3000;

const DATA_FILE = './todos.json';
const LOG_FILE = './logs.txt';

const logger = new EventEmitter();

logger.on('log', (message) => {
  const logMsg = `${new Date().toISOString()} - ${message}\n`;
  fs.appendFile(LOG_FILE, logMsg, (err) => {
    if (err) console.error('Logging error:', err);
  });
});

const sendResponse = (res, statusCode, data) => {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
};

const getTodos = () => {
  try {
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch {
    return [];
  }
};

const saveTodos = (todos) => {
  fs.writeFileSync(DATA_FILE, JSON.stringify(todos, null, 2));
};

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const id = parseInt(parsedUrl.pathname.split('/')[2]);
  const method = req.method;
  let body = '';

  req.on('data', chunk => (body += chunk));
  req.on('end', () => {
    logger.emit('log', `${method} ${parsedUrl.pathname}`);

    let todos = getTodos();

    // GET -- Fetch all todos
    if (method === 'GET' && parsedUrl.pathname === '/todos') {
      const { completed } = parsedUrl.query;
      if (completed !== undefined) {
        todos = todos.filter(todo => String(todo.completed) === completed);
      }
      return sendResponse(res, 200, todos);
    }

    // GET -- Fetch a specific todo by ID
    if (method === 'GET' && parsedUrl.pathname.match(/^\/todos\/\d+$/)) {
      const todo = todos.find(t => t.id === id);
      return todo
        ? sendResponse(res, 200, todo)
        : sendResponse(res, 404, { message: 'Todo not found' });
    }

    // POST -- Create a new todo
    if (method === 'POST' && parsedUrl.pathname === '/todos') {
      try {
        const { title, completed = false } = JSON.parse(body);
        if (!title) return sendResponse(res, 400, { message: 'Title is required' });

        const newTodo = {
          id: todos.length ? Math.max(...todos.map(t => t.id)) + 1 : 1,
          title,
          completed
        };
        todos.push(newTodo);
        saveTodos(todos);
        return sendResponse(res, 200, newTodo);
      } catch {
        return sendResponse(res, 400, { message: 'Invalid JSON' });
      }
    }

    // PUT -- Update a todo by ID
    if (method === 'PUT' && parsedUrl.pathname.match(/^\/todos\/\d+$/)) {
      try {
        const index = todos.findIndex(t => t.id === id);
        if (index === -1) return sendResponse(res, 404, { message: 'Todo not found' });

        const { title, completed } = JSON.parse(body);
        if (!title && completed === undefined)
          return sendResponse(res, 400, { message: 'Missing fields' });

        if (title) todos[index].title = title;
        if (completed !== undefined) todos[index].completed = completed;
        saveTodos(todos);
        return sendResponse(res, 200, todos[index]);
      } catch {
        return sendResponse(res, 400, { message: 'Invalid JSON' });
      }
    }

    // DELETE -- Delete a todo by ID
    if (method === 'DELETE' && parsedUrl.pathname.match(/^\/todos\/\d+$/)) {
      const index = todos.findIndex(t => t.id === id);
      if (index === -1) return sendResponse(res, 404, { message: 'Todo not found' });

      const deleted = todos.splice(index, 1);
      saveTodos(todos);
      return sendResponse(res, 200, deleted[0]);
    }

    // If no route matched , return 404
    sendResponse(res, 404, { message: 'Route not found' });
  });
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
