#!/usr/bin/env node

const fs = require("fs"),
  commonHelpers = require("./commonHelpers");

const { gatherAllBookmarks, stripBookmarks } = commonHelpers;

const mergeBookmarks = (bookmarkArray1, bookmarkArray2) => {
  const merged = [];
  const urlsAndDates = {};
  for (const b of [...bookmarkArray1, ...bookmarkArray2]) {
    if (!urlsAndDates[b.url] || b.date_added > urlsAndDates[b.url]) {
      merged.push(b);
      urlsAndDates[b.url] = b.date_added;
    }
  }

  // reassign id's
  let id = 1000;
  for (const b of merged) {
    b.id = `${id}`;
    id++;
  }
  return merged;
};

const { argv } = require("yargs")
  .option("bookmarkPath1", {
    alias: "bp1",
    type: "string",
    description: "First bookmark path"
  })
  .option("bookmarkPath2", {
    alias: "bp2",
    type: "string",
    description: "Second bookmark path"
  })
  .option("destination", {
    alias: "d",
    type: "string",
    description: "destination path (can be the same as bp1 or bp2)"
  });

const bookmarkJson1 = JSON.parse(fs.readFileSync(argv.bookmarkPath1));
const bookmarkJson2 = JSON.parse(fs.readFileSync(argv.bookmarkPath2));

const gathered1 = gatherAllBookmarks(bookmarkJson1);
const gathered2 = gatherAllBookmarks(bookmarkJson2);

const mergedBookmarks = mergeBookmarks(gathered1, gathered2);

const stripped = stripBookmarks(bookmarkJson1);
stripped.roots.bookmark_bar.children = mergedBookmarks;
fs.writeFileSync(argv.destination, JSON.stringify(stripped));
console.log("finished");
