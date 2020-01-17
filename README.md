# bookmark-querying

- query brave bookmarks from command line

* installation _(from this directory, after cloning repo)_:
  - `npm i -g .`

## examples:

```sh
# get help
bq --help

# list all your bookmarks
bq

# filter bookmarks whose url or name includes "foo" or "bar"
bq -g "(foo|bar)"

# delete those
bq -g "(foo|bar)" -d

# sort results by added date, ascending
bq -s
# descending
bq -S

# return only the "url" and "name" fields (of date_added,name,url)
bq -f url,name

# launch url in default browser
#    note: if your query returned multiple results, the most recently added will be used
bq -l
```

## config file

The following file is created on first run:

- `${HOME}/.config/bookmark_querying/config.json`

There, you can adjust the:

- browser bookmark path
- output field delimiter
