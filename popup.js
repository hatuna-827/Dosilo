"use strict"
const container = document.getElementById("main")
let folder_list = []
let menu

document.body.addEventListener('click', remove_menu)

chrome.storage.local.get("Dosilo", ({ Dosilo = {} }) => {
  const default_path = Dosilo.default_path || ['1']
  open_path(default_path)
})

function open_path(path) {
  container.innerHTML = ""
  folder_list = []
  chrome.bookmarks.getTree(([root]) => {
    add_folder(root.id, 0, true)
    open_folder(root, path, 0)
  })
}

function open_folder(data, path, node) {
  if (node == path.length) { return }
  const next = data.children.find(child => child.id === path[node])
  if (!next) {
    alert(`デフォルトのパスが見つかりません。(${path[node]})`)
    if (node == 0) { open_path(['1']) }
    return
  }
  add_folder(next.id, node + 1, node != path.length - 1)
  open_folder(next, path, node + 1)
}

function add_folder(folder_id, node, collapse) {
  chrome.bookmarks.getSubTree(folder_id, ([folder_data]) => {
    const wrapper = document.createElement('div')
    wrapper.className = "wrapper"
    wrapper.dataset.id = folder_id
    wrapper.dataset.node = node
    if (collapse) { wrapper.classList.add("collapse") }
    // collapse_button
    const collapse_button = document.createElement('div')
    collapse_button.className = "collapse-button"
    collapse_button.textContent = "◀"
    collapse_button.addEventListener('click', function () {
      if (wrapper.classList.contains("collapse")) {
        wrapper.classList.remove("collapse")
      } else {
        wrapper.classList.add("collapse")
      }
    })
    wrapper.appendChild(collapse_button)
    // folder_title
    const folder_title = document.createElement('div')
    folder_title.className = "folder-title"
    folder_title.textContent = folder_data.title
    folder_title.addEventListener('contextmenu', function (e) {
      add_menu(e, "title", folder_title, { node })
    })
    wrapper.appendChild(folder_title)
    // close_button
    if (node != 0) {
      const close_button = document.createElement('div')
      close_button.className = "close-button"
      close_button.textContent = "✖"
      close_button.addEventListener('click', function () { close(node) })
      wrapper.appendChild(close_button)
    }
    const content = document.createElement('div')
    content.className = "content"
    wrapper.appendChild(content)
    add_content(wrapper)
    folder_list.push(wrapper)
    container.appendChild(wrapper)
  })
}

function add_content(wrapper) {
  const folder_id = wrapper.dataset.id
  const node = wrapper.dataset.node
  const content = wrapper.querySelector(".content")
  content.innerHTML = ""
  chrome.bookmarks.getSubTree(folder_id, ([folder_data]) => {
    folder_data.children.forEach((child) => {
      if (child.url) {
        const link = document.createElement('span')
        link.className = "link target"
        link.textContent = "🔗 " + (child.title || "(no title)")
        link.addEventListener('click', function () {
          chrome.tabs.create({ url: child.url, active: true })
        })
        link.addEventListener('contextmenu', function (e) {
          add_menu(e, "url", link, { child })
        })
        content.appendChild(link)
      } else if (child.children) {
        const folder = document.createElement('span')
        folder.className = "folder target"
        folder.textContent = "📁 " + (child.title || "(no title)")
        folder.addEventListener('click', function () {
          close(node + 1)
          add_folder(child.id, node + 1)
        })
        folder.addEventListener('contextmenu', function (e) {
          add_menu(e, "folder", folder, { child })
        })
        content.appendChild(folder)
      }
    })
  })
}

function rerender() {
  container.childNodes.forEach(wrapper => add_content(wrapper))
}

function add_menu(e, type, target, { child, node }) {
  e.preventDefault()
  remove_menu()
  target.classList.add("menu-target")
  menu = document.createElement('div')
  menu.className = "menu"
  if (type === "url") {
  }
  else if (type === "folder") {
    const open_links = document.createElement('div')
    open_links.textContent = "すべてを開く"
    open_links.addEventListener('click', function () {
      oepn_urls(child, false)
    })
    menu.appendChild(open_links)
    const open_tree = document.createElement('div')
    open_tree.textContent = "フォルダ内をすべて開く"
    open_tree.addEventListener('click', function () {
      oepn_urls(child, true)
    })
    menu.appendChild(open_tree)
    const sort_name = document.createElement('div')
    sort_name.textContent = "タイトルでソートする"
    sort_name.addEventListener('click', function () {
      chrome.bookmarks.getChildren(child.id, (children) => {
        children.sort((a, b) => a.title.localeCompare(b.title))
        children.forEach((child, i) => {
          chrome.bookmarks.move(child.id, {
            parentId: child.id,
            index: i
          })
        })
        rerender()
      })
    })
    menu.appendChild(sort_name)
  }
  else if (type === "title") {
    const set_default = document.createElement('div')
    set_default.textContent = "デフォルトのフォルダに設定する"
    set_default.addEventListener('click', function () {
      let path = []
      container.childNodes.forEach(el => {
        path.push(el.dataset.id)
      })
      chrome.storage.local.set({ Dosilo: { default_path: path.slice(1, node + 1) } })
    })
    menu.appendChild(set_default)
  }
  document.body.appendChild(menu)
  menu.style.left = e.pageX - (window.innerWidth < e.pageX + menu.offsetWidth ? menu.offsetWidth : 0) + "px"
  menu.style.top = e.pageY - (window.innerHeight < e.pageY + menu.offsetHeight ? menu.offsetHeight : 0) + "px"
}

function oepn_urls(node, tree) {
  node.children.forEach(child => {
    if (child.url) {
      chrome.tabs.create({ url: child.url, active: false })
    } else if (tree && child.children) {
      oepn_urls(child, true)
    }
  })
}

function close(index) {
  folder_list.slice(index).forEach((folder) => {
    folder.remove()
  })
  folder_list.splice(index, folder_list.length - index)
}

function remove_menu() {
  if (menu) {
    const menu_target = document.querySelector(".menu-target")
    if (menu_target) { menu_target.classList.remove("menu-target") }
    menu.remove()
    menu = null
  }
}
