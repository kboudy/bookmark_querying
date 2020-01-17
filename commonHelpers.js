const gatherAllBookmarks = obj => {
  let bookmarks = [];
  for (const k in obj) {
    if (Array.isArray(obj[k])) {
      for (const a of obj[k]) {
        if (a.url && a.name) {
          // this destructuring syntax removes the children, sync_timestamp, & sync_transaction_version fields
          const {
            children,
            sync_timestamp,
            sync_transaction_version,
            ...cleaned
          } = a;
          bookmarks.push(cleaned);
        } else if (a.children) {
          bookmarks = [...bookmarks, ...gatherAllBookmarks(a)];
        }
      }
    } else {
      if (obj[k] === Object(obj[k])) {
        // it's an object, so we'll recurse it
        bookmarks = [...bookmarks, ...gatherAllBookmarks(obj[k])];
      }
    }
  }
  return bookmarks;
};
module.exports.gatherAllBookmarks = gatherAllBookmarks;

const stripBookmarks = obj => {
  for (const k in obj) {
    if (Array.isArray(obj[k])) {
      const newArray = [];
      for (const a of obj[k]) {
        if (!a.url || !a.name) {
          newArray.push(stripBookmarks(a));
        }
      }
      obj[k] = newArray;
    } else {
      if (obj[k] === Object(obj[k])) {
        // it's an object, so we'll recurse it
        obj[k] = stripBookmarks(obj[k]);
      }
    }
  }
  return obj;
};
module.exports.stripBookmarks = stripBookmarks;
