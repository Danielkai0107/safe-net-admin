import { Client, FlexMessage } from '@line/bot-sdk';

interface AlertData {
  id: string;
  title: string;
  message: string;
  severity: string;
  elderName: string;
  elderPhone?: string;
  triggeredAt: string;
  latitude?: number;
  longitude?: number;
}

export const sendAlertAssignment = async (
  lineUserId: string,
  channelAccessToken: string,
  alertData: AlertData
): Promise<void> => {
  const client = new Client({
    channelAccessToken,
  });

  // 建立 Flex Message
  const flexMessage: FlexMessage = {
    type: 'flex',
    altText: `警報分配通知：${alertData.title}`,
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: '警報分配通知',
            weight: 'bold',
            size: 'lg',
            color: '#111111',
          },
        ],
        backgroundColor: '#FFFFFF',
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: alertData.title,
            weight: 'bold',
            size: 'md',
            wrap: true,
            margin: 'none',
          },
          {
            type: 'text',
            text: alertData.message,
            size: 'sm',
            wrap: true,
            margin: 'md',
            color: '#666666',
          },
          {
            type: 'separator',
            margin: 'lg',
          },
          {
            type: 'box',
            layout: 'vertical',
            margin: 'lg',
            spacing: 'sm',
            contents: [
              {
                type: 'box',
                layout: 'baseline',
                spacing: 'sm',
                contents: [
                  {
                    type: 'text',
                    text: '長輩',
                    size: 'sm',
                    color: '#999999',
                    flex: 2,
                  },
                  {
                    type: 'text',
                    text: alertData.elderName,
                    size: 'sm',
                    color: '#111111',
                    flex: 5,
                    wrap: true,
                  },
                ],
              },
              ...(alertData.elderPhone ? [{
                type: 'box' as const,
                layout: 'baseline' as const,
                spacing: 'sm' as const,
                contents: [
                  {
                    type: 'text' as const,
                    text: '電話',
                    size: 'sm' as const,
                    color: '#999999',
                    flex: 2,
                  },
                  {
                    type: 'text' as const,
                    text: alertData.elderPhone,
                    size: 'sm' as const,
                    color: '#111111',
                    flex: 5,
                  },
                ],
              }] : []),
              {
                type: 'box',
                layout: 'baseline',
                spacing: 'sm',
                contents: [
                  {
                    type: 'text',
                    text: '時間',
                    size: 'sm',
                    color: '#999999',
                    flex: 2,
                  },
                  {
                    type: 'text',
                    text: new Date(alertData.triggeredAt).toLocaleString('zh-TW'),
                    size: 'sm',
                    color: '#111111',
                    flex: 5,
                    wrap: true,
                  },
                ],
              },
            ],
          },
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          {
            type: 'box',
            layout: 'horizontal',
            spacing: 'sm',
            contents: [
              {
                type: 'button',
                style: 'primary',
                color: '#22C55E',
                action: {
                  type: 'postback',
                  label: '✓ 接受',
                  data: `action=accept&alertId=${alertData.id}`,
                  displayText: '我接受處理這個警報',
                },
              },
              {
                type: 'button',
                style: 'secondary',
                action: {
                  type: 'postback',
                  label: '✗ 拒絕',
                  data: `action=decline&alertId=${alertData.id}`,
                  displayText: '我無法處理這個警報',
                },
              },
            ],
          },
          {
            type: 'button',
            style: 'link',
            action: {
              type: 'uri',
              label: alertData.latitude && alertData.longitude ? '📍 查看地圖位置' : '查看詳情',
              uri: alertData.latitude && alertData.longitude
                ? `https://www.google.com/maps?q=${alertData.latitude},${alertData.longitude}`
                : `https://liff.line.me/${process.env.LIFF_ID}/alerts/${alertData.id}`,
            },
          },
          {
            type: 'text',
            text: '請盡快確認並處理此警報',
            size: 'xs',
            color: '#999999',
            align: 'center',
            margin: 'sm',
          },
        ],
      },
    },
  };

  // 發送訊息
  await client.pushMessage(lineUserId, flexMessage);
};

export const sendNotification = async (
  lineUserId: string,
  channelAccessToken: string,
  message: string
): Promise<void> => {
  const client = new Client({
    channelAccessToken,
  });

  await client.pushMessage(lineUserId, {
    type: 'text',
    text: message,
  });
};
