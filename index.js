#!/usr/bin/env node

const chalk = require("chalk"),
  opn = require("opn"),
  fs = require("fs"),
  homedir = require("os").homedir(),
  path = require("path"),
  moment = require("moment"),
  commonHelpers = require("./commonHelpers");

const { gatherAllBookmarks, stripBookmarks } = commonHelpers;

const writeCompletionFile = () => {
  const fp = path.join(homedir, ".config/zsh/completions/_bq");
  if (!fs.existsSync(path.dirname(fp))) {
    mkdirp.sync(path.dirname(fp));
  }
  if (!fs.existsSync(fp)) {
    let completionFile = `#compdef bq\n\n_arguments`;

    for (const o in argOptions) {
      const item = argOptions[o];
      completionFile =
        completionFile +
        ` '-${item.alias}[${item.description.replace(
          "'",
          "''"
        )}]' '--${o}[${item.description.replace("'", "''")}]'`;
    }
    fs.writeFileSync(fp, completionFile);
  }
};

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

const argOptions = {
  fields: {
    alias: "f",
    type: "string",
    description: "Comma-delimited field names (#,date_added,name,url)"
  },
  query: {
    alias: "q",
    type: "string",
    description: "regex for query (against the url & bookmark name)"
  },
  launch: {
    alias: "l",
    default: "1",
    type: "string",
    description:
      "launch first url (or #'d, if you supply it) in default browser"
  },
  delete: {
    alias: "d",
    default: "*",
    type: "string",
    description: "delete queried bookmarks"
  },
  sort: {
    alias: "s",
    type: "boolean",
    description: "sort by date added"
  },
  sort_descending: {
    alias: "S",
    type: "boolean",
    description: "sort by date added, descending"
  }
};

const { argv } = require("yargs")
  .alias("help", "h")
  .version(false)
  .options(argOptions);

const deleteBookmarks = (bookmarkJson, flattened, urlsToDelete) => {
  const stripped = stripBookmarks(bookmarkJson);
  const survivors = flattened.filter(f => !urlsToDelete.includes(f.url));
  stripped.roots.bookmark_bar.children = survivors;
  fs.writeFileSync(config.bookmarkPath, JSON.stringify(stripped));
  console.log(chalk.red(urlsToDelete.join("\n")));
  console.log();
  console.log(chalk.red(`Deleted ${urlsToDelete.length} bookmarks`));
};

const queryBookmarks = () => {
  const bookmarkJson = JSON.parse(fs.readFileSync(config.bookmarkPath));
  const flattened = gatherAllBookmarks(bookmarkJson);

  const availableFields = ["#", "date_added", "name", "url"];
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
  let resultNumber = 0;
  for (const b of sorted) {
    let nameMatch;
    let urlMatch;
    if (argv.query) {
      const regEx = new RegExp(argv.query, "i");
      nameMatch = b.name.match(regEx);
      urlMatch = b.url.match(regEx);
      if (!nameMatch && !urlMatch) {
        continue;
      }
    }
    resultNumber++;

    let outString = "";
    let isFirst = true;
    for (const f of outputFields) {
      let renderedField = b[f];
      if (f === "#") {
        renderedField = `${resultNumber}`;
      } else if (f === "date_added") {
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
    // because a yargs default (of "1") is supplied for the launch arg, it always says the switch is present
    // there must be a yargs way to check if it actually was typed, but for now, I'm manually checking
    const deleteSwitchExists =
      process.argv.filter(a => a === "-d" || a === "-delete").length > 0;
    if (deleteSwitchExists) {
      let urlsToDelete = matches.map(m => m.url);
      if (argv.delete !== "*") {
        const lineNumbersToDelete = argv.delete
          .split(",")
          .map(n => parseInt(n));
        const newUrls = [];
        for (const l of lineNumbersToDelete) {
          newUrls.push(urlsToDelete[l - 1]);
        }
        urlsToDelete = newUrls;
      }
      deleteBookmarks(bookmarkJson, flattened, urlsToDelete);
    }
  } else {
    console.log(chalk.green(`${matches.length} bookmarks`));
  }
  if (argv.launch) {
    // because a yargs default (of "1") is supplied for the launch arg, it always says the switch is present
    // there must be a yargs way to check if it actually was typed, but for now, I'm manually checking
    const launchSwitchExists =
      process.argv.filter(a => a === "-l" || a === "-launch").length > 0;
    if (launchSwitchExists) {
      if (matches.length === 0) {
        console.log(chalk.red("There were no matches to launch"));
      } else {
        const launchIndex = parseInt(argv.launch) - 1;
        if (isNaN(launchIndex)) {
          console.log(
            chalk.red(`"${argv.launch}": launch # should be an integer`)
          );
        } else if (launchIndex < 0 || launchIndex >= matches.length) {
          console.log(chalk.red(`${argv.launch}: No such result # to launch`));
        } else {
          opn(matches[launchIndex].url);
        }
      }
    }
  }
};

const debugging =
  typeof v8debug === "object" ||
  /--debug|--inspect/.test(process.execArgv.join(" "));
if (debugging) {
  queryBookmarks();
}
writeCompletionFile();
module.exports = () => {
  queryBookmarks();
};
