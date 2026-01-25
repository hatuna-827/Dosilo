"use strict"
const container = document.getElementById("main")
let open_list = []
let menu

document.body.addEventListener('click', remove_menu)

chrome.storage.local.get("Dosilo", ({ Dosilo = {} }) => {
  const default_path = Dosilo.default_path || ['1']
  open_path(default_path)
})

function open_path(path) {
  chrome.bookmarks.getTree(([root]) => {
    container.innerHTML = ""
    open_list = []
    let node = 0
    let data = root
    while (node !== path.length) {
      const next = data.children.find(child => child.id === path[node])
      if (!next) {
        alert("デフォルトのパスが見つかりません。")
        path = path.slice(0, node + 1)
        if (node == 0) { path = ['1'] }
        break
      }
      data = next
      ++node
    }
    add_wrapper('0', 0, true)
    path.forEach((id, node) => {
      add_wrapper(id, node + 1, node != path.length - 1)
    })
  })
}

function add_wrapper(id, node, collapse) {
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
}

function render_wrapper(node) {
  const wrapper = open_list[node]
  const folder_title = wrapper.querySelector(".folder-title")
  const content = wrapper.querySelector(".content")
  chrome.bookmarks.getSubTree(wrapper.dataset.id, ([folder_data]) => {
    folder_title.textContent = folder_data.title
    content.innerHTML = ""
    folder_data.children.forEach((child) => {
      if (child.url) {
        const link = $(content, "link target", "🔗 " + (child.title || "(no title)"), 'span')
        link.addEventListener('click', function () {
          chrome.tabs.create({ url: child.url, active: true })
        })
        link.addEventListener('contextmenu', function (e) {
          add_menu(e, "url", link, child.id, node)
        })
      } else if (child.children) {
        const folder = $(content, "folder target", "📁 " + (child.title || "(no title)"), 'span')
        folder.addEventListener('click', function () {
          close(node + 1)
          add_wrapper(child.id, node + 1, false)
        })
        folder.addEventListener('contextmenu', function (e) {
          add_menu(e, "folder", folder, child.id, node)
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
  remove_menu()
  target.classList.add("menu-target")
  menu = document.createElement('div')
  menu.className = "menu"
  const menu_data = {
    title: [
      {
        content: "デフォルトのフォルダに設定する", command: (id, node) => {
          chrome.storage.local.set({ Dosilo: { default_path: open_list.map(el => el.dataset.id).slice(1, node + 1) } })
        },
      }
    ],
    url: [
      {
        content: "削除", command: (id, node) => {
          chrome.bookmarks.remove(id)
          render_wrapper(node)
        }
      },
    ],
    folder: [
      { content: "すべて開く", command: (id) => { open_urls(id, false) } },
      { content: "フォルダ内をすべて開く", command: (id) => { open_urls(id, true) } },
      {
        content: "タイトルでソートする",
        command: (id, node) => {
          chrome.bookmarks.getChildren(id, (children) => {
            children.sort((a, b) => a.title.localeCompare(b.title))
            children.forEach((child, i) => {
              chrome.bookmarks.move(child.id, {
                parentId: id,
                index: i
              })
            })
            render_wrapper(node + 1)
          })
        }
      },
      {
        content: "ここに展開", command: (id, node) => {
          chrome.bookmarks.getSubTree(id, ([folder_data]) => {
            folder_data.children.forEach((child, i) => {
              chrome.bookmarks.create({
                index: folder_data.index + i + 1,
                parentId: folder_data.parentId,
                title: child.title,
                url: child.url
              })
              render_wrapper(node)
            })
          })
        }
      },
      {
        content: "削除", command: (id, node) => {
          chrome.bookmarks.removeTree(id)
          render_wrapper(node)
          if (open_list[node + 1].dataset.id === id) { close(node + 1) }
        }
      },
    ]
  }
  menu_data[type].forEach(({ content, command }) => {
    const item = document.createElement('div')
    item.textContent = content
    item.addEventListener('click', function () { command(id, node) })
    menu.appendChild(item)
  })
  document.body.appendChild(menu)
  menu.style.left = e.pageX - (window.innerWidth < e.pageX + menu.offsetWidth ? menu.offsetWidth : 0) + "px"
  menu.style.top = e.pageY - (window.innerHeight < e.pageY + menu.offsetHeight ? menu.offsetHeight : 0) + "px"
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
  chrome.bookmarks.getChildren(id, (children) => {
    children.forEach(child => {
      if (child.url) {
        chrome.tabs.create({ url: child.url, active: false })
      } else if (tree && child.children) {
        open_urls(child.id, true)
      }
    })
  })
}

function $(parentElement, className, textContent, tagName) {
  const result = document.createElement(tagName || 'div')
  result.className = className || ''
  result.textContent = textContent || ''
  parentElement.appendChild(result)
  return result
}
