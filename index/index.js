"use strict"
/* - import ------------------------------------------------------------------------------------ */

import { form, dialog } from "./popup.js"

/* - const ------------------------------------------------------------------------------------- */

const main = document.getElementById("main")
let open_list = []
let menu
let dragEl = null
let dragParent = {}

const menu_data = {
  title: [
    {
      type: "command", content: "デフォルトのフォルダに設定", command: (id, node) => {
        chrome.storage.local.set({
          Dosilo: {
            default_path: open_list.map(el => el.dataset.id).slice(1, node + 1)
          }
        })
      }
    },
    { type: "partition" },
    {
      type: "command", content: "名前を変更", command: (id, node) => {
        chrome.bookmarks.get(id, ([data]) => {
          form(
            "フォルダ名の編集",
            [{ title: "名前", type: "string", default_value: data.title }],
            "保存",
            (title) => {
              chrome.bookmarks.update(id, { title })
                .catch((e) => { menu_error(e) })
              render_wrapper(node)
              render_wrapper(node - 1)
            }
          )
        })
      }
    },
    {
      type: "command", content: "リンクを追加", command: (id, node) => {
        add_new_link(node, id)
      }
    },
    {
      type: "command", content: "フォルダを追加", command: (id, node) => {
        add_new_folder(node, id)
      }
    },
  ],
  url: [
    {
      type: "command", content: "編集", command: (id, node) => {
        chrome.bookmarks.get(id, ([data]) => {
          form(
            "リンクの編集",
            [
              { title: "名前", type: "string", default_value: data.title },
              { title: "URL", type: "string", default_value: data.url },
            ],
            "保存",
            (title, url) => {
              chrome.bookmarks.update(id, { title, url })
                .catch((e) => { menu_error(e) })
              render_wrapper(node)
            })
        })
      }
    },
    { type: "partition" },
    {
      type: "command", content: "リンクを追加", command: (id, node) => {
        chrome.bookmarks.get(id, ([data]) => {
          add_new_link(node, data.parentId, data.index + 1)
        })
      }
    },
    {
      type: "command", content: "フォルダを追加", command: (id, node) => {
        chrome.bookmarks.get(id, ([data]) => {
          add_new_folder(node, data.parentId, data.index + 1)
        })
      }
    },
    { type: "partition" },
    {
      type: "command", content: "削除", command: (id, node) => {
        chrome.bookmarks.remove(id)
          .catch((e) => { menu_error(e) })
        render_wrapper(node)
      }
    },
  ],
  folder: [
    { type: "command", content: "すべて開く", command: (id) => { open_urls(id, false) } },
    { type: "command", content: "フォルダ内をすべて開く", command: (id) => { open_urls(id, true) } },
    { type: "partition" },
    {
      type: "command", content: "名前を変更", command: (id, node) => {
        chrome.bookmarks.get(id, ([data]) => {
          form(
            "フォルダ名の編集",
            [{ title: "名前", type: "string", default_value: data.title }],
            "保存",
            (title) => {
              chrome.bookmarks.update(id, { title })
                .catch((e) => { menu_error(e) })
              render_wrapper(node)
              if (open_list[node + 1] && id === open_list[node + 1].dataset.id) { render_wrapper(node + 1) }
            }
          )
        })
      }
    },
    {
      type: "command", content: "リンクを追加", command: (id, node) => {
        chrome.bookmarks.get(id, ([data]) => {
          add_new_link(node, data.parentId, data.index + 1)
        })
      }
    },
    {
      type: "command", content: "フォルダを追加", command: (id, node) => {
        chrome.bookmarks.get(id, ([data]) => {
          add_new_folder(node, data.parentId, data.index + 1)
        })
      }
    },
    { type: "partition" },
    {
      type: "command", content: "展開", command: (id, node) => {
        chrome.bookmarks.getSubTree(id, ([folder_data]) => {
          folder_data.children.forEach((child, i) => {
            chrome.bookmarks.create({
              index: folder_data.index + i + 1,
              parentId: folder_data.parentId,
              title: child.title,
              url: child.url
            })
              .catch((e) => { menu_error(e) })
            render_wrapper(node)
          })
        })
      }
    },
    {
      type: "command", content: "タイトルでソート", command: (id, node) => {
        chrome.bookmarks.getChildren(id, (children) => {
          children.sort((a, b) => a.title.localeCompare(b.title))
          children.forEach((child, i) => {
            chrome.bookmarks.move(child.id, { parentId: id, index: i })
              .catch((e) => { menu_error(e) })
          })
          if (open_list[node + 1] && id === open_list[node + 1].dataset.id) { render_wrapper(node + 1) }
        })
      }
    },
    { type: "partition" },
    {
      type: "command", content: "削除", command: (id, node) => {
        chrome.bookmarks.removeTree(id)
          .catch((e) => { menu_error(e) })
        render_wrapper(node)
        if (open_list[node + 1] && open_list[node + 1].dataset.id === id) { close(node + 1) }
      }
    },
  ]
}

/* - init -------------------------------------------------------------------------------------- */

chrome.storage.local.get("Dosilo", ({ Dosilo = {} }) => {
  const default_path = Dosilo.default_path || ['1']
  open_path(default_path)
})

/* - add eventListener ------------------------------------------------------------------------- */

document.body.addEventListener('click', remove_menu)

/* - function ---------------------------------------------------------------------------------- */

function getDragAfterElement(container, y) {
  const elements = [...container.querySelectorAll(".entry:not(.dragging)")]
  return elements.reduce((closest, child, i) => {
    const size = child.getBoundingClientRect()
    const offset = y - size.top - size.height / 2
    if (offset < 0 && offset > closest.offset) {
      return { offset: offset, element: child, index: i }
    } else {
      return closest
    }
  }, { offset: Number.NEGATIVE_INFINITY, index: container.childElementCount - 1 })
}


function open_path(path) {
  chrome.bookmarks.getTree(([root]) => {
    main.innerHTML = ""
    open_list = []
    let node = 0
    let data = root
    while (node !== path.length) {
      const next = data.children.find(child => child.id === path[node])
      if (!next) {
        dialog("初期エラー", "デフォルトのパスが見つかりません。")
        path = path.slice(0, node)
        if (node === 0) { path = ['1'] }
        break
      }
      data = next
      ++node
    }
    add_wrapper('0', 0, true)
    path.forEach((id, node) => {
      add_wrapper(id, node + 1, node !== path.length - 1)
    })
  })
}

function add_wrapper(id, node, collapse) {
  const container = $(main, "container")
  const wrapper = $(container, "wrapper")
  open_list.push(wrapper)
  wrapper.dataset.id = id
  wrapper.dataset.node = node
  if (collapse) { wrapper.classList.add("collapse") }
  // collapse_button
  const collapse_button = $(wrapper, "collapse-button", "◀")
  collapse_button.addEventListener('click', function () {
    if (wrapper.classList.contains("collapse"))
      wrapper.classList.remove("collapse")
    else
      wrapper.classList.add("collapse")
  })
  // close_button
  if (node !== 0) {
    const close_button = $(wrapper, "close-button", "✖")
    close_button.addEventListener('click', function () { close(node) })
  }
  // folder_title
  const folder_title = $(wrapper, "folder-title")
  folder_title.addEventListener('contextmenu', function (e) {
    add_menu(e, "title", folder_title, id, node)
  })
  const content = $(wrapper, "content")
  render_wrapper(node)
  wrapper.scrollIntoView()
  content.addEventListener('dragstart', function (e) {
    if (e.target.classList && e.target.classList.contains("entry-move")) {
      dragEl = e.target.closest(".entry")
      dragEl.classList.add("dragging")
      dragParent = { node, open: (open_list[node + 1] && (dragEl.dataset.id === open_list[node + 1].dataset.id)) }
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setDragImage(new Image(), 0, 0)
    } else {
      e.preventDefault()
    }
  })
  content.addEventListener('dragend', function (e) {
    if (!dragEl) return
    if (dragParent.open && dragParent.node < node) return
    const afterIndex = getDragAfterElement(content, e.clientY).index
    chrome.bookmarks.move(dragEl.dataset.id, { parentId: id })
    chrome.bookmarks.move(dragEl.dataset.id, { index: afterIndex, parentId: id })
    render_wrapper(dragParent.node)
    render_wrapper(node)
    dragEl = null
    dragParent = {}
  })
  content.addEventListener('dragover', function (e) {
    e.preventDefault()
    if (!dragEl) return
    if (dragParent.open && dragParent.node < node) return
    const afterElement = getDragAfterElement(content, e.clientY).element
    content.insertBefore(dragEl, afterElement)
  })
  content.addEventListener('contextmenu', function (e) {
    add_menu(e, "title", this, id, node)
  })
}

function render_wrapper(node) {
  const wrapper = open_list[node]
  const folder_title = wrapper.querySelector(".folder-title")
  const content = wrapper.querySelector(".content")
  chrome.bookmarks.getSubTree(wrapper.dataset.id, ([folder_data]) => {
    folder_title.textContent = folder_data.title
    content.innerHTML = ""
    folder_data.children.forEach((child) => {
      const entry = document.createElement('div')
      entry.className = "entry"
      entry.dataset.id = child.id
      content.appendChild(entry)
      const move = document.createElement('span')
      move.className = "entry-move"
      move.draggable = true
      entry.appendChild(move)
      if (child.url) {
        move.textContent = "🔗"
        const link = document.createElement('span')
        link.className = "link entry-title"
        link.textContent = child.title || "(no title)"
        entry.appendChild(link)
        entry.addEventListener('click', function () {
          chrome.tabs.create({ url: child.url, active: true })
        })
        entry.addEventListener('contextmenu', function (e) {
          add_menu(e, "url", this, child.id, node)
        })
      } else if (child.children) {
        move.textContent = "📁"
        const folder = document.createElement('span')
        folder.className = "folder entry-title"
        folder.textContent = child.title || "(no title)"
        entry.appendChild(folder)
        entry.addEventListener('click', function () {
          close(node + 1)
          add_wrapper(child.id, node + 1, false)
        })
        entry.addEventListener('contextmenu', function (e) {
          add_menu(e, "folder", this, child.id, node)
        })
      }
    })
  })
}

function close(index) {
  open_list.slice(index).forEach((folder) => { folder.remove() })
  open_list.splice(index, open_list.length - index)
}

function add_menu(e, type, target, id, node) {
  e.preventDefault()
  e.stopPropagation()
  remove_menu()
  target.classList.add("menu-target")
  menu = document.createElement('div')
  menu.className = "menu"
  add_menu_items(menu_data[type], menu, id, node)
  document.body.appendChild(menu)
  menu.style.left = e.pageX - (window.innerWidth < e.pageX + menu.offsetWidth ? menu.offsetWidth : 0) + "px"
  menu.style.top = e.pageY - (window.innerHeight < e.pageY + menu.offsetHeight ? menu.offsetHeight : 0) + "px"
}

function add_menu_items(menu_items, pos, id, node) {
  menu_items.forEach((menu_item) => {
    const type = menu_item.type
    if (type === "command") {
      const item = document.createElement('div')
      item.className = "item command"
      item.textContent = menu_item.content
      item.addEventListener('click', function () { menu_item.command(id, node) })
      pos.appendChild(item)
    } else if (type === "partition") {
      const hr = document.createElement('hr')
      hr.className = "partition"
      pos.appendChild(hr)
    } else if (type === "group") {
      const item = document.createElement('div')
      item.className = "item group"
      item.textContent = menu_item.content
      const group_items = document.createElement('div')
      group_items.className = "group-items"
      add_menu_items(menu_item.children, group_items, id, node)
      item.appendChild(group_items)
      pos.appendChild(item)
    }
  })
}

function remove_menu() {
  if (menu) {
    const menu_target = document.querySelector(".menu-target")
    if (menu_target) { menu_target.classList.remove("menu-target") }
    menu.remove()
    menu = null
  }
}

function menu_error(e) {
  dialog(
    "実行時エラー",
    `
    操作が失敗しました。
    ルートブックマークフォルダーでは一部の操作を実行できません。
    ${e}
    `
  )
}

function open_urls(id, tree) {
  chrome.bookmarks.getChildren(id, (children) => {
    children.forEach(child => {
      if (child.url) {
        chrome.tabs.create({ url: child.url, active: false })
      } else if (tree) {
        open_urls(child.id, true)
      }
    })
  })
}

function add_new_link(node, parentId, index) {
  form(
    "新しいリンク",
    [
      { title: "名前", type: "string", default_value: document.title },
      { title: "URL", type: "string", default_value: window.location.href },
    ],
    "追加",
    (title, url) => {
      chrome.bookmarks.create({ parentId, title, url, index })
        .catch((e) => { menu_error(e) })
      render_wrapper(node)
    }
  )
}
function add_new_folder(node, parentId, index) {
  form(
    "新しいフォルダ",
    [{ title: "名前", type: "string", default_value: "新しいフォルダ" }],
    "追加",
    (title) => {
      chrome.bookmarks.create({ parentId, title, index })
        .catch((e) => { menu_error(e) })
      render_wrapper(node)
    }
  )
}

function $(parentElement, className, textContent, tagName) {
  const result = document.createElement(tagName || 'div')
  result.className = className || ''
  result.textContent = textContent || ''
  parentElement.appendChild(result)
  return result
}
/* --------------------------------------------------------------------------------------------- */
