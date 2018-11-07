'use strict';

const { promisify } = require('util');
const fs = require('fs');

const express = require('express');

const packageObject = require(`${__dirname}/../index`);

const readFileAsync = promisify(fs.readFile);

const app = express();
const PORT = 4000;

app.get('/', async (req, res) => {
  const commonCss = await readFileAsync(`${__dirname}/../common.css`);
  const packageKey = req.query.packageKey;
  const query = req.query.query;
  const trigger = await packageObject[packageKey].trigger(query);
  if (packageKey in packageObject && trigger) {
    const result = await packageObject[packageKey][packageKey](query);
    res.send(`
      <div class="answerInner">${result}</div>
      <style type="text/css">
        ${commonCss}
        body {
          margin: 0;
          font-family: Lato,Helvetica,sans-serif;
          letter-spacing: .1px;
        }
      </style>
    `);
  }
  else {
    res.status('400');
    res.send('Bad request, package key does not exist or package was not triggered for specified query');
  }
});

app.listen(PORT, () => console.log(`Server listening on: ${PORT}`));
