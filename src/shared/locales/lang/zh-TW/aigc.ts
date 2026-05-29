export default {
  title: '智能助手',
  subheading: 'AIGC',
  field: {
    key: '密鑰',
    model: '模型',
    providerMap: {
      anthropic: 'Anthropic',
      google: 'Google',
      ollama: 'Ollama',
      openai: 'OpenAI',
    },
  },
  chat: {
    tip: '你好! 我是 {0} 智能助手, 有什麼可以幫助你的吗?',
    suggestion: {
      desc: {
        title: '{0} 是什麼?',
        prompt: '介紹一下 {0}',
      },
      hot: {
        title: '本月熱播',
        prompt: '獲取{0}年{1}月的熱播劇, 並按照上映時間進行排列',
      },
    },
    sender: {
      think: '深度思考',
      search: '聯網搜索',
    },
    modelChange: '由 {0} 模型提供服務',
    stopGenerating: '用戶已停止內容生成',
    chunk: {
      think: {
        title: '思考',
        thinking: '思考中...',
        thinked: '已思考完成',
      },
      search: {
        title: '搜索',
        searching: '搜索中...',
        searched: '搜索到 {0} 篇相關資料',
      },
      tool: {
        title: '工具',
        calling: '正在調用工具 {0}...',
        called: '工具 {0} 調用完成',
      },
    },
  },
  declare: '內容由AI生成, 請仔細甄別',
  noParam: '參數不正確, 請前往 [設置->基礎配置] 配置AIGC相關數據',
  message: {
    createSessionFailed: '創建會話失敗',
  },
};
