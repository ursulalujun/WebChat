/* 
  聊天室的主要功能
*/
/* 
  1. 连接socketio服务
*/

var socket = io('http://localhost:3000');
// publicKeyB, AESKeyB 表示对方的公钥和AES密钥
var username, avatar, privateKey, publicKey, publicKeyB, AESKey_str, AESKey, AESKeyB, encryptedAESKey;

/* 
  2. 登录功能
*/
$('#login_avatar li').on('click', function() {
  $(this)
    .addClass('now')
    .siblings()
    .removeClass('now')
})
// 点击按钮，登录
$('#login_avatar li').on('click', function() {
  $(this)
      .addClass('now')
      .siblings()
      .removeClass('now')
})
// 点击按钮，登录
$('#loginBtn').on('click', function() {
  // 获取用户名
  var username = $('#username')
      .val()
      .trim()
  if (!username) {
    alert('请输入用户名')
    return
  }

  //导入私钥
  const privateKey_str = '55bb4cb6407303de8e4c5a635021d3db12cb537305eeb6401612ce14b35d6690'
  const AESKey_str = '123456'
  AESKey = new Buffer(AESKey_str, 'hex')
  privateKey = new Buffer(privateKey_str, 'hex')
  publicKey = util.privateToPublic(privateKey)
  //将私钥保存在本地
  localStorage.setItem(username, privateKey_str)

  // 获取选择的头像
  var avatar = $('#login_avatar li.now img').attr('src')

  // 需要告诉socket io服务，登录
  socket.emit('login', {
    username: username,
    avatar: avatar
  })
})


// 监听登录失败的请求
socket.on('loginError', data => {
  alert('用户名已经存在')
})
// 监听登录成功的请求
socket.on('loginSuccess', data => {
  // 需要显示聊天窗口
  // 隐藏登录窗口
  $('.login_box').fadeOut()
  $('.container').fadeIn()
  // 设置个人信息
  console.log(data)
  $('.avatar_url').attr('src', data.avatar)
  $('.user-list .username').text(data.username)

  username = data.username
  avatar = data.avatar

  //将该用户的公钥发送给服务器
  socket.emit('sendPublicKey', {
    publicKey: publicKey,
    username: username,
    avatar: avatar
  })
})

// 监听别的用户发送来的公钥
socket.on('receivePublicKey', data => {
  if(username !== data.username)
  {
    publicKeyB = data.publicKey
  }
  console.info(publicKeyB)
  const publicKeyB_str = data.publicKey.toString();
  // 存储别人的公钥，由于只有本次对话中使用，sessionStorage即可
  sessionStorage.setItem(data.username, publicKeyB_str);
  // 用对方的公钥对AES密钥进行加密
  encryptedAESKey = ecies.encrypt(publicKey, AESKey);//publicKeyB
})

// 监听添加用户的消息
socket.on('addUser', data => {
  // 添加一条系统消息
  $('.box-bd').append(`
    <div class="system">
      <p class="message_system">
        <span class="content">${data.username}加入了群聊</span>
      </p>
    </div>
  `)
  scrollIntoView()
})

/*
  3.用户列表
 */
// 监听用户列表的消息
socket.on('userList', data => {
  // 把userList中的数据动态渲染到左侧菜单
  $('.user-list ul').html('')
  data.forEach(item => {
    $('.user-list ul').append(`
      <li class="user">
        <div class="avatar"><img src="${item.avatar}" alt="" /></div>
        <div class="name">${item.username}</div>
      </li>      
    `)
  })

  $('#userCount').text(data.length)
})

// 监听用户离开的消息
socket.on('delUser', data => {
  // 添加一条系统消息
  $('.box-bd').append(`
    <div class="system">
      <p class="message_system">
        <span class="content">${data.username}离开了群聊</span>
      </p>
    </div>
  `)
  scrollIntoView()
})

/*
  4.聊天功能
*/
$('.btn-send').on('click', () => {
  // 获取到聊天的内容
  var content = $('#content').html()
  $('#content').html('')
  if (!content) return alert('请输入内容')
  //对明文进行加密,AES加密函数使用string格式的密钥和message，返回buffer
  //converting your string to a CryptoJS wordArray
  const cipherText = CryptoJS.AES.encrypt(CryptoJS.enc.Utf8.parse(content), '123456')
  console.info(cipherText)
  // 发送给服务器
  socket.emit('sendMessage', {
    msg: cipherText,
    encryptedAESKey: encryptedAESKey,
    username: username,
    avatar: avatar
  })
  //将自己的消息显示在聊天窗口中
  $('.box-bd').append(`
      <div class="message-box">
        <div class="my message">
          <img class="avatar" src="${avatar}" alt="" />
          <div class="content">
            <div class="bubble">
              <div class="bubble_cont">${content}</div>
            </div>
          </div>
        </div>
      </div>
    `)
})

// 监听聊天的消息
socket.on('receiveMessage', data => {
  // 不接收自己的消息
  if (data.username !== username)
  {
    // 解密接收到的消息
    const dataBuffer = new Buffer(data.msg)
    console.info(localStorage.getItem(username))
    const DecryptedAESKey = ecies.decrypt(privateKey,data.encryptedAESKey).toString('utf8')
    const DecryptedText = CryptoJS.AES.decrypt(dataBuffer, DecryptedAESKey)
    // 把解密后的消息显示到聊天窗口中
       // 别人的消息
      $('.box-bd').append(`
        <div class="message-box">
          <div class="other message">
            <img class="avatar" src="${data.avatar}" alt="" />
            <div class="content">
              <div class="nickname">${data.username}</div>
              <div class="bubble">
                <div class="bubble_cont">${DecryptedText}</div>
              </div>
            </div>
          </div>
        </div>
      `)
  }
  scrollIntoView()
})

function scrollIntoView() {
  // 当前元素的底部滚动到可视区
  $('.box-bd')
    .children(':last')
    .get(0)
    .scrollIntoView(false)
}

/*
  5.发送图片功能
 */
$('#file').on('change', function() {
  var file = this.files[0]

  // 需要把这个文件发送到服务器， 借助于H5新增的fileReader
  var fr = new FileReader()
  fr.readAsDataURL(file)
  fr.onload = function() {
    socket.emit('sendImage', {
      username: username,
      avatar: avatar,
      img: fr.result
    })
  }
})

// 监听图片聊天信息
socket.on('receiveImage', data => {
  // 把接收到的消息显示到聊天窗口中
  if (data.username === username) {
    // 自己的消息
    $('.box-bd').append(`
      <div class="message-box">
        <div class="my message">
          <img class="avatar" src="${data.avatar}" alt="" />
          <div class="content">
            <div class="bubble">
              <div class="bubble_cont">
                <img src="${data.img}">
              </div>
            </div>
          </div>
        </div>
      </div>
    `)
  } else {
    // 别人的消息
    $('.box-bd').append(`
      <div class="message-box">
        <div class="other message">
          <img class="avatar" src="${data.avatar}" alt="" />
          <div class="content">
            <div class="nickname">${data.username}</div>
            <div class="bubble">
              <div class="bubble_cont">
                <img src="${data.img}">
              </div>
            </div>
          </div>
        </div>
      </div>
    `)
  }
  // 等待图片加载完成,在滚动到底部
  $('.box-bd img:last').on('load', function() {
    scrollIntoView()
  })
})

// 初始化jquery-emoji插件
$('.face').on('click', function() {
  $('#content').emoji({
    // 设置触发表情的按钮
    button: '.face',
    showTab: false,
    animation: 'slide',
    position: 'topRight',
    icons: [
      {
        name: 'QQ表情',
        path: 'lib/jquery-emoji/img/qq/',
        maxNum: 91,
        excludeNums: [41, 45, 54],
        file: '.gif'
      }
    ]
  })
})
