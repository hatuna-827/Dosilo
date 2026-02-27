"use strict"

import { render_id } from "./index.js"
import { menu_error } from "./popup.js"

function create(CreateDetails, callback = () => { }, error_callback = menu_error) {
  chrome.bookmarks.create(CreateDetails)
    .then(callback)
    .catch(error_callback)
}

function get(id, callback, error_callback = menu_error) {
  chrome.bookmarks.get(id)
    .then(callback)
    .catch(error_callback)
}

function get_children(id, callback, error_callback = menu_error) {
  chrome.bookmarks.getChildren(id)
    .then(callback)
    .catch(error_callback)
}

function get_with_children(id, callback, error_callback = menu_error) {
  get(id, ([data]) => {
    get_children(id, (children) => {
      data.children = children
      callback(data)
    }, error_callback)
  }, error_callback)
}

function get_sub_tree(id, callback, error_callback = menu_error) {
  chrome.bookmarks.getSubTree(id)
    .then(callback)
    .catch(error_callback)
}

function get_tree(callback, error_callback = menu_error) {
  chrome.bookmarks.getTree()
    .then(callback)
    .catch(error_callback)
}

function move(id, destination, callback = () => { }, error_callback = menu_error) {
  chrome.bookmarks.move(id, destination)
    .then(callback)
    .catch(error_callback)
}

function remove(id, callback = () => { }, error_callback = menu_error) {
  get(id, ([data]) => {
    if (data.url) {
      chrome.bookmarks.remove(id)
        .then(callback)
        .catch(error_callback)
    } else {
      chrome.bookmarks.removeTree(id)
        .then(callback)
        .catch(error_callback)
    }
  })
}

function update(id, changes, callback = () => { }, error_callback = menu_error) {
  chrome.bookmarks.update(id, changes)
    .then(callback)
    .catch(error_callback)
}

function clone(parentId, id, index) {
  get(id, ([data]) => {
    if (data.url) {
      create({
        index: index,
        parentId: parentId,
        title: data.title,
        url: data.url
      })
    } else {
      create(
        {
          index: index,
          parentId: parentId,
          title: data.title
        },
        (new_folder) => {
          deploy_folder(new_folder.id, id, 0, true)
        }
      )
    }
    render_id(parentId)
  })
}

function deploy_folder(parentId, id, index, tree) {
  get_children(id, (children) => {
    children.reverse().forEach((child) => {
      if (child.url) {
        clone(parentId, child.id, index)
      } else if (tree) {
        clone(parentId, child.id, index)
      }
    })
    render_id(parentId)
  })
}

function sort_title(id) {
  get_children(id, (children) => {
    children.sort((a, b) => a.title.localeCompare(b.title))
    children.forEach((child) => {
      move(child.id, { parentId: id })
    })
    render_id(id)
  })
}

function sort_reverse(id) {
  get_children(id, (children) => {
    children.forEach((child) => {
      move(child.id, { parentId: id, index: 0 })
    })
    render_id(id)
  })
}

function sort_folders_first(id) {
  get_children(id, (children) => {
    children.forEach((child) => {
      if (child.url) {
        move(child.id, { parentId: id })
      }
    })
    render_id(id)
  })
}

function remove_duplicate_urls(id) {
  const seen = new Set()
  get_children(id, (children) => {
    children.forEach((child) => {
      if (child.url) {
        if (seen.has(child.url)) {
          remove(child.id, () => {
            render_id(id)
          })
        }
        seen.add(child.url)
      }
    })
  })
}

function remove_empty_folders(id) {
  get_children(id, (children) => {
    children.forEach((child) => {
      if (!child.url) {
        get_children(child.id, (folder_children) => {
          if (folder_children.length === 0) {
            remove(child.id)
          }
        })
      }
    })
    render_id(id)
  })
}

remove.duplicate = remove_duplicate_urls
remove.empty = remove_empty_folders
export const bookmark = {
  create,
  get,
  getChildren: get_children,
  getWithChildren: get_with_children,
  // getSubTree: get_sub_tree,
  // getTree: get_tree,
  move,
  remove,
  update,
  clone,
  deployFolder: deploy_folder,
  sort: {
    title: sort_title,
    reverse: sort_reverse,
    folder: sort_folders_first,
  },
}
