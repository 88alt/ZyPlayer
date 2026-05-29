export default {
  title: '智能助手',
  subheading: 'AIGC',
  field: {
    key: '密钥',
    model: '模型',
    providerMap: {
      anthropic: 'Anthropic',
      google: 'Google',
      ollama: 'Ollama',
      openai: 'OpenAI',
    },
  },
  chat: {
    tip: '你好! 我是 {0} 智能助手, 有什么可以帮助你的吗?',
    suggestion: {
      desc: {
        title: '{0} 是什么?',
        prompt: '介绍一下 {0}',
      },
      hot: {
        title: '本月热播',
        prompt: '获取{0}年{1}月的热播剧, 并按照上映时间进行排列',
      },
    },
    sender: {
      think: '深度思考',
      search: '联网搜索',
    },
    chunk: {
      think: {
        title: '思考',
        thinking: '思考中...',
        thinked: '已思考完成',
      },
      search: {
        title: '搜索',
        searching: '搜索中...',
        searched: '搜索到 {0} 篇相关资料',
      },
      tool: {
        title: '工具',
        calling: '正在调用工具 {0}...',
        called: '工具 {0} 调用完成',
      },
    },
    modelChange: '由 {0} 模型提供服务',
    stopGenerating: '用户已停止内容生成',
  },
  declare: '内容由AI生成, 请仔细甄别',
  noParam: '参数不正确, 请前往 [设置->基础配置] 配置AIGC相关数据',
  message: {
    createSessionFailed: '创建会话失败',
  },
};
