"use strict"

/* - import ------------------------------------------------------------------------------------ */

import { form, dialog, confirm } from "./popup.js"
import { bookmark } from "./bookmark.js"

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
      type: "command", content: "名前を変更", command: (id) => {
        bookmark.get(id, ([data]) => {
          form(
            "フォルダ名の編集",
            [{ title: "名前", type: "string", default_value: data.title }],
            "保存",
            (title) => {
              bookmark.update(id, { title })
              render_id(id)
              render_id(data.parentId)
            }
          )
        })
      }
    },
    { type: "command", content: "リンクを追加", command: (id) => { add_new_link(id) } },
    { type: "command", content: "フォルダを追加", command: (id) => { add_new_folder(id) } },
    { type: "partition" },
    { type: "command", content: "タイトルでソート", command: (id) => { bookmark.sort.title(id) } },
    { type: "command", content: "並び順を反転", command: (id) => { bookmark.sort.reverse(id) } },
    { type: "command", content: "フォルダを先頭へ", command: (id) => { bookmark.sort.folder(id) } },
    { type: "partition" },
    { type: "command", content: "重複したURLを削除", command: (id) => { bookmark.remove.duplicate(id) } },
    { type: "command", content: "空のフォルダを削除", command: (id) => { bookmark.remove.empty(id) } },
  ],
  url: [
    {
      type: "command", content: "編集", command: (id, node) => {
        bookmark.get(id, ([data]) => {
          form(
            "リンクの編集",
            [
              { title: "名前", type: "string", default_value: data.title },
              { title: "URL", type: "string", default_value: data.url },
            ],
            "保存",
            (title, url) => {
              bookmark.update(id, { title, url })
              render_node(node)
            })
        })
      }
    },
    { type: "partition" },
    {
      type: "command", content: "リンクを追加", command: (id) => {
        bookmark.get(id, ([data]) => {
          add_new_link(data.parentId, data.index + 1)
        })
      }
    },
    {
      type: "command", content: "フォルダを追加", command: (id) => {
        bookmark.get(id, ([data]) => {
          add_new_folder(data.parentId, data.index + 1)
        })
      }
    },
    {
      type: "command", content: "複製", command: (id) => {
        bookmark.get(id, ([data]) => {
          bookmark.clone(data.parentId, id, data.index + 1)
        })
      }
    },
    { type: "partition" },
    {
      type: "command", content: "詳細を見る", command: (id) => {
        bookmark.getWithChildren(id, (data) => {
          dialog(
            `${id} の詳細`,
            [
              `ID : ${data.id}`,
              `種類 : ブックマーク`,
              `タイトル : "${data.title}"`,
              `URL : ${data.url}`,
              `作成日時 : ${time_to_string(data.dateAdded)}`,
              `アクセス日時 : ${time_to_string(data.dateLastUsed)}`,
              `親フォルダID : ${data.parentId}`,
            ]
          )
        })
      }
    },
    {
      type: "command", content: "削除", command: (id, node) => {
        confirm(
          "リンクを削除",
          "この操作は取り消せません。",
          "削除",
          () => {
            bookmark.remove(id, () => {
              render_node(node)
            })
          }
        )
      }
    },
  ],
  folder: [
    {
      type: "group", content: "すべて開く", command: (id) => { open_urls(id, false) }, children: [
        { type: "command", content: "フォルダ内をすべて開く", command: (id) => { open_urls(id, true) } },
        {
          type: "command", content: "フォルダ内をすべて開いて削除", command: (id, node) => {
            open_urls(id, true)
            bookmark.remove(id, () => {
              render_node(node)
            })
          }
        },
      ]
    },
    { type: "partition" },
    {
      type: "command", content: "名前を変更", command: (id, node) => {
        bookmark.get(id, ([data]) => {
          form(
            "フォルダ名の編集",
            [{ title: "名前", type: "string", default_value: data.title }],
            "保存",
            (title) => {
              bookmark.update(id, { title })
              render_node(node)
              render_id(id)
            }
          )
        })
      }
    },
    {
      type: "command", content: "リンクを追加", command: (id) => {
        bookmark.get(id, ([data]) => {
          add_new_link(data.parentId, data.index + 1)
        })
      }
    },
    {
      type: "command", content: "フォルダを追加", command: (id) => {
        bookmark.get(id, ([data]) => {
          add_new_folder(data.parentId, data.index + 1)
        })
      }
    },
    {
      type: "command", content: "複製", command: (id) => {
        bookmark.get(id, ([data]) => {
          bookmark.clone(data.parentId, id, data.index + 1)
        })
      }
    },
    { type: "partition" },
    {
      type: "command", content: "リンクのみ展開", command: (id) => {
        bookmark.get(id, ([folder_data]) => {
          bookmark.deployFolder(folder_data.parentId, id, folder_data.index + 1, false)
        })
      }
    },
    {
      type: "command", content: "フォルダ内を展開", command: (id) => {
        bookmark.get(id, ([folder_data]) => {
          bookmark.deployFolder(folder_data.parentId, id, folder_data.index + 1, true)
        })
      }
    },
    {
      type: "command", content: "分割", command: (id, node) => {
        form(
          "分割",
          [{ title: "分割数", type: "number", default_value: 10 }],
          "決定",
          (division_count) => {
            bookmark.getWithChildren(id, (data) => {
              let children = data.children
              bookmark.create(
                { parentId: data.parentId, index: data.index + 1, title: `分割-${data.title}` },
                (current_folder) => {
                  let count = 0
                  while (children.length !== 0) {
                    const division_children = children.splice(0, division_count)
                    bookmark.create({ parentId: current_folder.id, title: `分割フォルダ${count}` }, (division_folder) => {
                      division_children.forEach((child) => {
                        bookmark.clone(division_folder.id, child.id)
                      })
                    })
                    ++count
                  }
                  render_node(node)
                })
            })
          }
        )
      }
    },
    { type: "partition" },
    {
      type: "command", content: "詳細を見る", command: (id) => {
        bookmark.getWithChildren(id, (data) => {
          dialog(
            `${id} の詳細`,
            [
              `ID : ${data.id}`,
              `種類 : ブックマークフォルダ`,
              `タイトル : "${data.title}"`,
              `子要素の数 : ${data.children.length}`,
              `作成日時 : ${time_to_string(data.dateAdded)}`,
              `更新日時 : ${time_to_string(data.dateGroupModified)}`,
              `親フォルダID : ${data.parentId}`,
            ]
          )
        })
      }
    },
    {
      type: "command", content: "削除", command: (id, node) => {
        confirm(
          "フォルダを削除",
          "この操作は取り消せません。",
          "削除",
          () => {
            bookmark.remove(id, () => {
              render_node(node)
              close_id(id)
            })
          }
        )
      }
    },
  ]
}

/* - init -------------------------------------------------------------------------------------- */

chrome.storage.local.get("Dosilo", ({ Dosilo = {} }) => {
  const default_path = Dosilo.default_path ?? ['1']
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
  main.innerHTML = ""
  open_list = []
  add_wrapper('0', 0, true)
  open_folder(path, 1, () => {
    open_list.slice(-1)[0].classList.remove("collapse")
    dialog(
      "初期エラー",
      [
        "デフォルトのパスが見つかりません。",
        path.join('>')
      ]
    )
  })
}

function open_folder(path, node, error_callback) {
  const id = path[0]
  const not_last = path.length !== 1
  add_wrapper(id, node, not_last)
  if (not_last) {
    const next_id = path[1]
    bookmark.get(next_id, ([children]) => {
      if (children.parentId === id) {
        open_folder(path.slice(1), node + 1, error_callback)
      } else {
        error_callback()
      }
    }, error_callback)
  }
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
  render_node(node)
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
    bookmark.move(dragEl.dataset.id, { parentId: id })
    bookmark.move(dragEl.dataset.id, { index: afterIndex, parentId: id })
    render_node(dragParent.node)
    render_node(node)
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

function render_wrapper(wrapper) {
  const folder_title = wrapper.querySelector(".folder-title")
  const content = wrapper.querySelector(".content")
  const node = Number(wrapper.dataset.node)
  bookmark.getWithChildren(wrapper.dataset.id, (folder_data) => {
    folder_title.textContent = folder_data.title
    content.innerHTML = ""
    folder_data.children.forEach((child) => {
      const entry = document.createElement('div')
      entry.className = "entry"
      entry.dataset.id = child.id
      entry.title = child.title
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
      } else {
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
      item.addEventListener('click', function (e) {
        if (e.target === this) { menu_item.command(id, node) }
      })
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

function open_urls(id, tree) {
  bookmark.getChildren(id, (children) => {
    children.forEach(child => {
      if (child.url) {
        chrome.tabs.create({ url: child.url, active: false })
      } else if (tree) {
        open_urls(child.id, true)
      }
    })
  })
}

function add_new_link(parentId, index) {
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    form(
      "新しいリンク",
      [
        { title: "名前", type: "string", default_value: tab.title ?? "" },
        { title: "URL", type: "string", default_value: tab.url ?? "" },
      ],
      "追加",
      (title, url) => {
        bookmark.create({ parentId, title, url, index })
        render_id(parentId)
      }
    )
  })
}

function add_new_folder(parentId, index) {
  form(
    "新しいフォルダ",
    [{ title: "名前", type: "string", default_value: "新しいフォルダ" }],
    "追加",
    (title) => {
      bookmark.create({ parentId, title, index })
      render_id(parentId)
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

function render_node(node) {
  render_wrapper(open_list[node])
}

export function render_id(id) {
  if (!Array.isArray(id)) { id = [id] }
  open_list
    .filter((wrapper) => (id.includes(wrapper.dataset.id)))
    .forEach((wrapper) => { render_wrapper(wrapper) })
}

function close_id(id) {
  if (!Array.isArray(id)) { id = [id] }
  let wrapper_data = open_list.map(wrapper => ({ node: Number(wrapper.dataset.node), id: wrapper.dataset.id }))
  wrapper_data = wrapper_data.filter((data) => (id.includes(data.id)))
  wrapper_data.forEach(({ node }) => { close(node) })
}

function time_to_string(epoch_ms) {
  const time = new Date(epoch_ms)
  const year = time.getFullYear()
  const month = time.getMonth()
  const date = time.getDate()
  const hours = time.getHours()
  const minutes = time.getMinutes()
  const seconds = time.getSeconds()
  return `${year}/${month}/${date},${hours}:${minutes}:${seconds}`
}

/* --------------------------------------------------------------------------------------------- */
