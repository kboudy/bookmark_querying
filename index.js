#!/usr/bin/env node

const chalk = require("chalk"),
  opn = require("opn"),
  fs = require("fs"),
  path = require("path"),
  moment = require("moment"),
  commonHelpers = require("./commonHelpers");

const { gatherAllBookmarks, stripBookmarks } = commonHelpers;

const homedir = require("os").homedir();

const homeConfig = path.join(require("os").homedir(), ".config");
if (!fs.existsSync(homeConfig)) {
  fs.mkdirSync(homeConfig);
}
const configDir = path.join(homeConfig, "bookmark_querying");
if (!fs.existsSync(configDir)) {
  fs.mkdirSync(configDir);
}
const configFilepath = path.join(configDir, "config.json");
let config;
if (!fs.existsSync(configFilepath)) {
  config = {
    bookmarkPath: path.join(
      homedir,
      ".config/BraveSoftware/Brave-Browser/Default/Bookmarks"
    ),
    delimiter: ","
  };
  fs.writeFileSync(configFilepath, JSON.stringify(config));
} else {
  config = JSON.parse(fs.readFileSync(configFilepath, "utf8"));
}

if (!fs.existsSync(config.bookmarkPath)) {
  console.log(
    chalk.red(
      "Could not find your browser's bookmark file.  Please update it in the config file here: "
    ) + chalk.white(configFilepath)
  );
  process.exit(1);
}

function formatAndLocalizeDate(st_dt) {
  var microseconds = parseInt(st_dt, 10);
  var millis = microseconds / 1000;
  var past = new Date(1601, 0, 1).getTime();
  var offset = moment().utcOffset();
  return moment(past + millis + offset * 60000).format("YYYY-MM-DD HH:mm:ss");
}

const { argv } = require("yargs")
  .option("fields", {
    alias: "f",
    type: "string",
    description: "Comma-delimited field names (date_added,name,url)"
  })
  .option("grep", {
    alias: "g",
    type: "string",
    description: "regex to grep"
  })
  .option("launch", {
    alias: "l",
    type: "boolean",
    description: "launch most recent bookark url in default browser"
  })
  .option("delete", {
    alias: "d",
    type: "boolean",
    description: "delete queried bookmarks"
  })
  .option("sort", {
    alias: "s",
    type: "boolean",
    description: "sort by date added"
  })
  .option("sort_descending", {
    alias: "S",
    type: "boolean",
    description: "sort by date added, descending"
  });

const deleteBookmarks = (bookmarkJson, flattened, matches) => {
  const stripped = stripBookmarks(bookmarkJson);
  const urlsToDelete = matches.map(m => m.url);
  const survivors = flattened.filter(f => !urlsToDelete.includes(f.url));
  stripped.roots.bookmark_bar.children = survivors;
  fs.writeFileSync(config.bookmarkPath, JSON.stringify(stripped));
  console.log(chalk.red(`Deleted ${matches.length} bookmarks`));
};

const queryBookmarks = () => {
  const bookmarkJson = JSON.parse(fs.readFileSync(config.bookmarkPath));
  const flattened = gatherAllBookmarks(bookmarkJson);

  const availableFields = ["date_added", "name", "url"];
  const outputFields = [];
  for (const f of (argv.fields || availableFields.join(","))
    .split(",")
    .map(f => f.trim().toLowerCase())) {
    if (availableFields.includes(f)) {
      outputFields.push(f);
    }
  }

  let sorted = flattened;
  if (argv.sort_descending) {
    sorted = flattened.sort((a, b) => b.date_added - a.date_added);
  } else if (argv.sort) {
    sorted = flattened.sort((a, b) => a.date_added - b.date_added);
  }
  const matches = [];
  for (const b of sorted) {
    let nameMatch;
    let urlMatch;
    if (argv.grep) {
      const regEx = new RegExp(argv.grep, "i");
      nameMatch = b.name.match(regEx);
      urlMatch = b.url.match(regEx);
      if (!nameMatch && !urlMatch) {
        continue;
      }
    }

    let outString = "";
    let isFirst = true;
    for (const f of outputFields) {
      let renderedField = b[f];
      if (f === "date_added") {
        renderedField = formatAndLocalizeDate(b[f]);
      } else if (f === "url" && urlMatch) {
        const beforeMatch = b[f].slice(0, urlMatch.index);
        const match = urlMatch[0];
        const afterMatch = b[f].slice(urlMatch.index + match.length);
        renderedField =
          chalk.white(beforeMatch) +
          chalk.black.bgYellowBright(match) +
          chalk.white(afterMatch);
      } else if (f === "name" && nameMatch) {
        const beforeMatch = b[f].slice(0, nameMatch.index);
        const match = nameMatch[0];
        const afterMatch = b[f].slice(nameMatch.index + match.length);
        renderedField =
          chalk.white(beforeMatch) +
          chalk.black.bgYellowBright(match) +
          chalk.white(afterMatch);
      }
      if (!isFirst) {
        outString = outString + chalk.gray(config.delimiter);
      }
      isFirst = false;
      outString = outString + `"${renderedField}"`;
    }
    matches.push(b);
    console.log(chalk.white(outString));
  }
  if (argv.delete) {
    deleteBookmarks(bookmarkJson, flattened, matches);
  } else {
    console.log(chalk.green(`${matches.length} bookmarks`));
  }
  if (argv.launch) {
    if (matches.length === 0) {
      console.log(chalk.red("There were no matches to launch"));
    } else {
      const descendingSort = matches.sort(
        (a, b) => a.date_added - b.date_added
      );
      opn(descendingSort[descendingSort.length - 1].url);
    }
  }
};

const debugging =
  typeof v8debug === "object" ||
  /--debug|--inspect/.test(process.execArgv.join(" "));
if (debugging) {
  queryBookmarks();
}

module.exports = () => {
  queryBookmarks();
};
