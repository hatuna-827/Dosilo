"use strict"

export function form(form_title, arguments_data, button_title, call_back) {
  let arguments_list = []
  displayPopup()
  setTitle(form_title)
  const content = document.getElementById("popup-content")
  content.innerHTML = ""
  const type_mapping = {
    string: "text",
    number: "number"
  }
  arguments_data.forEach(({ title, type, default_value }, i) => {
    const wrapper = document.createElement('div')
    wrapper.className = "form-wrapper"
    const name = document.createElement('div')
    name.className = "form-name"
    name.textContent = title
    const input = document.createElement('input')
    input.className = "form-input"
    input.type = type_mapping[type] ?? "text"
    input.value = default_value
    arguments_list.push(input)
    wrapper.appendChild(name)
    wrapper.appendChild(input)
    content.appendChild(wrapper)
    if (i === 0) { input.focus() }
  })
  const buttons = document.getElementById("popup-buttons")
  buttons.innerHTML = ""
  const button = document.createElement('button')
  button.className = "form-button-main"
  button.textContent = button_title
  button.addEventListener('click', function () {
    call_back(...arguments_list.map((input) => input.type === "text" ? input.value : input.valueAsNumber))
    hidePopup()
  })
  buttons.appendChild(button)
  const cancel = document.createElement('button')
  cancel.className = "form-button"
  cancel.textContent = "キャンセル"
  cancel.addEventListener('click', function () {
    hidePopup()
  })
  buttons.appendChild(cancel)
}

export function dialog(title, context) {
  displayPopup()
  setTitle(title)
  setContext(context)
  const buttons = document.getElementById("popup-buttons")
  buttons.innerHTML = ""
  const close = document.createElement('button')
  close.className = "form-button"
  close.textContent = "閉じる"
  close.addEventListener('click', function () {
    hidePopup()
  })
  buttons.appendChild(close)
  close.focus()
}

export function confirm(title, context, button_title, call_back) {
  displayPopup()
  setTitle(title)
  setContext(context)
  const buttons = document.getElementById("popup-buttons")
  buttons.innerHTML = ""
  const button = document.createElement('button')
  button.className = "form-button-main"
  button.textContent = button_title
  button.addEventListener('click', function () {
    call_back()
    hidePopup()
  })
  buttons.appendChild(button)
  button.focus()
  const cancel = document.createElement('button')
  cancel.className = "form-button"
  cancel.textContent = "キャンセル"
  cancel.addEventListener('click', function () {
    hidePopup()
  })
  buttons.appendChild(cancel)
}

export function menu_error(e) {
  dialog(
    "実行時エラー",
    [
      "操作が失敗しました。",
      e,
    ]
  )
}

function displayPopup() {
  document.getElementById("popup-container").style.display = 'flex'
}

function hidePopup() {
  document.getElementById("popup-container").style.display = 'none'
}

function setTitle(form_title) {
  document.getElementById("popup-title").textContent = form_title
}

function setContext(context) {
  if (Array.isArray(context)) {
    context = context.join('\n')
  }
  const content = document.getElementById("popup-content")
  content.innerHTML = ""
  content.innerText = context
}