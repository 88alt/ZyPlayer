export default {
  title: 'Intelligent Assistant',
  subheading: 'AIGC',
  field: {
    key: 'Key',
    model: 'Model',
    providerMap: {
      anthropic: 'Anthropic',
      google: 'Google',
      ollama: 'Ollama',
      openai: 'OpenAI',
    },
  },
  chat: {
    tip: 'Hello! I am the {0} intelligent assistant, how can I help you?',
    suggestion: {
      desc: {
        title: 'What is {0}?',
        prompt: 'Introduce {0}',
      },
      hot: {
        title: "This month's popular",
        prompt: 'Get the popular dramas of {0} year {1} month, and arrange them in order of release time',
      },
    },
    sender: {
      think: 'Think',
      search: 'Search',
    },
    chunk: {
      think: {
        title: 'Think',
        thinking: 'Thinking...',
        thinked: 'Thinking complete',
      },
      search: {
        title: 'Search',
        searching: 'Searching...',
        searched: 'Found {0} related materials',
      },
      tool: {
        title: 'Tool',
        calling: 'Calling tool {0}...',
        called: 'Tool {0} call completed',
      },
    },
    modelChange: 'Provided by {0} model',
    stopGenerating: 'User has stopped content generation',
  },
  declare: 'Content is AI-generated. Please review carefully.',
  noParam: 'Params are incorrect, please go to [Setting->Base Config] to configure AIGC related data.',
  message: {
    createSessionFailed: 'Create session failed',
  },
};
