import { Devvit } from '@devvit/public-api';
import { handlePoemMessage, PoemMessage, PoemResponse } from './poem-handlers';

// Side effect import to bundle the server
import '../server/index';

Devvit.configure({
  redditAPI: true,
  redis: true,
  http: true,
});

export const Preview: Devvit.BlockComponent<{ text?: string }> = ({ text = 'Loading...' }) => {
  return (
    <zstack width={'100%'} height={'100%'} alignment="center middle">
      <vstack width={'100%'} height={'100%'} alignment="center middle">
        <image
          url="loading.gif"
          description="Loading..."
          height={'140px'}
          width={'140px'}
          imageHeight={'240px'}
          imageWidth={'240px'}
        />
        <spacer size="small" />
        <text maxWidth={`80%`} size="large" weight="bold" alignment="center middle" wrap>
          {text}
        </text>
      </vstack>
    </zstack>
  );
};

// Add webview for the poem generator
Devvit.addCustomPostType({
  name: 'Skinny Poem Generator',
  height: 'tall',
  render: (context) => {
    const { useState, useAsync } = context;

    const { data, loading, error } = useAsync(async () => {
      // Initialize webview data
      return {
        url: 'index.html',
        data: { 
          postId: context.postId,
          userId: context.userId,
          subredditName: context.subredditName
        }
      };
    });

    // Handle messages from webview
    const onMessage = async (msg: PoemMessage) => {
      try {
        console.log('Received webview message:', msg);
        const response: PoemResponse = await handlePoemMessage(msg, context);
        
        // Send response back to webview
        context.ui.webView.postMessage('poem-generator', response);
      } catch (error) {
        console.error('Error handling webview message:', error);
        const errorResponse: PoemResponse = {
          type: 'ERROR',
          message: error instanceof Error ? error.message : 'Unknown error'
        };
        context.ui.webView.postMessage('poem-generator', errorResponse);
      }
    };

    if (loading) {
      return <Preview text="Loading Poem Generator..." />;
    }

    if (error) {
      return <Preview text={`Error: ${error.message}`} />;
    }

    return (
      <vstack width="100%" height="100%">
        <webview
          id="poem-generator"
          url={data?.url || 'index.html'}
          width="100%"
          height="100%"
          onMessage={onMessage}
        />
      </vstack>
    );
  },
});

// Menu item for creating new poem posts
Devvit.addMenuItem({
  label: '[Skinny Poem Generator] New Post',
  location: 'subreddit',
  forUserType: 'moderator',
  onPress: async (_event, context) => {
    const { reddit, ui } = context;

    let post;
    try {
      const subreddit = await reddit.getCurrentSubreddit();
      post = await reddit.submitPost({
        title: 'Daily Skinny Poem Generator',
        subredditName: subreddit.name,
        preview: <Preview text="Collaborative Poetry Creation" />,
      });
      
      ui.showToast({ text: 'Created poem generator post!' });
      ui.navigateTo(post.url);
    } catch (error) {
      if (post) {
        await post.remove(false);
      }
      if (error instanceof Error) {
        ui.showToast({ text: `Error creating post: ${error.message}` });
      } else {
        ui.showToast({ text: 'Error creating post!' });
      }
    }
  },
});

export default Devvit;