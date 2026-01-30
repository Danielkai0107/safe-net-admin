"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendNotificationPointAlert = exports.sendNotification = exports.sendAlertAssignment = void 0;
const bot_sdk_1 = require("@line/bot-sdk");
const sendAlertAssignment = async (lineUserId, channelAccessToken, alertData) => {
    const client = new bot_sdk_1.Client({
        channelAccessToken,
    });
    // 建立 Flex Message
    const flexMessage = {
        type: "flex",
        altText: `警報分配通知：${alertData.title}`,
        contents: {
            type: "bubble",
            header: {
                type: "box",
                layout: "vertical",
                contents: [
                    {
                        type: "text",
                        text: "警報分配通知",
                        weight: "bold",
                        size: "lg",
                        color: "#111111",
                    },
                ],
                backgroundColor: "#FFFFFF",
            },
            body: {
                type: "box",
                layout: "vertical",
                contents: [
                    {
                        type: "text",
                        text: alertData.title,
                        weight: "bold",
                        size: "md",
                        wrap: true,
                        margin: "none",
                    },
                    {
                        type: "text",
                        text: alertData.message,
                        size: "sm",
                        wrap: true,
                        margin: "md",
                        color: "#666666",
                    },
                    {
                        type: "separator",
                        margin: "lg",
                    },
                    {
                        type: "box",
                        layout: "vertical",
                        margin: "lg",
                        spacing: "sm",
                        contents: [
                            {
                                type: "box",
                                layout: "baseline",
                                spacing: "sm",
                                contents: [
                                    {
                                        type: "text",
                                        text: "長輩",
                                        size: "sm",
                                        color: "#999999",
                                        flex: 2,
                                    },
                                    {
                                        type: "text",
                                        text: alertData.elderName,
                                        size: "sm",
                                        color: "#111111",
                                        flex: 5,
                                        wrap: true,
                                    },
                                ],
                            },
                            ...(alertData.elderPhone
                                ? [
                                    {
                                        type: "box",
                                        layout: "baseline",
                                        spacing: "sm",
                                        contents: [
                                            {
                                                type: "text",
                                                text: "電話",
                                                size: "sm",
                                                color: "#999999",
                                                flex: 2,
                                            },
                                            {
                                                type: "text",
                                                text: alertData.elderPhone,
                                                size: "sm",
                                                color: "#111111",
                                                flex: 5,
                                            },
                                        ],
                                    },
                                ]
                                : []),
                            {
                                type: "box",
                                layout: "baseline",
                                spacing: "sm",
                                contents: [
                                    {
                                        type: "text",
                                        text: "時間",
                                        size: "sm",
                                        color: "#999999",
                                        flex: 2,
                                    },
                                    {
                                        type: "text",
                                        text: new Date(alertData.triggeredAt).toLocaleString("zh-TW"),
                                        size: "sm",
                                        color: "#111111",
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
                type: "box",
                layout: "vertical",
                spacing: "sm",
                contents: [
                    {
                        type: "box",
                        layout: "horizontal",
                        spacing: "sm",
                        contents: [
                            {
                                type: "button",
                                style: "primary",
                                color: "#22C55E",
                                height: "sm",
                                action: {
                                    type: "postback",
                                    label: "✓ 接受",
                                    data: `action=accept&alertId=${alertData.id}`,
                                    displayText: "我接受處理這個警報",
                                },
                            },
                            {
                                type: "button",
                                style: "secondary",
                                height: "sm",
                                action: {
                                    type: "postback",
                                    label: "✗ 拒絕",
                                    data: `action=decline&alertId=${alertData.id}`,
                                    displayText: "我無法處理這個警報",
                                },
                            },
                        ],
                    },
                    {
                        type: "button",
                        style: "link",
                        height: "sm",
                        action: {
                            type: "uri",
                            label: alertData.latitude && alertData.longitude
                                ? "查看地圖位置"
                                : "查看詳情",
                            uri: alertData.latitude && alertData.longitude
                                ? `https://www.google.com/maps?q=${alertData.latitude},${alertData.longitude}`
                                : `https://liff.line.me/${process.env.LIFF_ID}/alerts/${alertData.id}`,
                        },
                    },
                    {
                        type: "text",
                        text: "請盡快確認並處理此警報",
                        size: "xs",
                        color: "#999999",
                        align: "center",
                        margin: "sm",
                    },
                ],
            },
        },
    };
    // 發送訊息
    await client.pushMessage(lineUserId, flexMessage);
};
exports.sendAlertAssignment = sendAlertAssignment;
const sendNotification = async (lineUserId, channelAccessToken, message) => {
    const client = new bot_sdk_1.Client({
        channelAccessToken,
    });
    await client.pushMessage(lineUserId, {
        type: "text",
        text: message,
    });
};
exports.sendNotification = sendNotification;
const sendNotificationPointAlert = async (lineUserId, channelAccessToken, data) => {
    const client = new bot_sdk_1.Client({
        channelAccessToken,
    });
    const timestamp = new Date(data.timestamp).toLocaleString("zh-TW", {
        timeZone: "Asia/Taipei",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    });
    const deviceName = data.deviceNickname || "您的設備";
    const isStore = data.isAD === true;
    // 建立 Flex Message
    const flexMessage = {
        type: "flex",
        altText: `通知點警報：${data.gatewayName}`,
        contents: Object.assign(Object.assign({ type: "bubble" }, (isStore && data.imageLink
            ? {
                hero: {
                    type: "image",
                    url: data.imageLink,
                    size: "full",
                    aspectRatio: "3:1",
                    aspectMode: "cover",
                },
            }
            : {})), { body: {
                type: "box",
                layout: "vertical",
                contents: [
                    // 第一行：已通過 location (商家加上「守護合作商家」)
                    {
                        type: "text",
                        text: isStore
                            ? `${deviceName} 已經過 守護合作商家`
                            : `${deviceName} 已經過`,
                        weight: "bold",
                        size: "md",
                        wrap: true,
                        margin: "none",
                    },
                    {
                        type: "text",
                        text: data.gatewayName,
                        size: "xl",
                        wrap: true,
                        margin: "md",
                        color: "#4ECDC4",
                        weight: "bold",
                    },
                    {
                        type: "separator",
                        margin: "lg",
                    },
                    {
                        type: "box",
                        layout: "vertical",
                        margin: "lg",
                        spacing: "sm",
                        contents: [
                            {
                                type: "box",
                                layout: "baseline",
                                spacing: "sm",
                                contents: [
                                    {
                                        type: "text",
                                        text: "設備",
                                        size: "sm",
                                        color: "#999999",
                                        flex: 2,
                                    },
                                    {
                                        type: "text",
                                        text: deviceName,
                                        size: "sm",
                                        color: "#111111",
                                        flex: 5,
                                        wrap: true,
                                    },
                                ],
                            },
                            {
                                type: "box",
                                layout: "baseline",
                                spacing: "sm",
                                contents: [
                                    {
                                        type: "text",
                                        text: "地點",
                                        size: "sm",
                                        color: "#999999",
                                        flex: 2,
                                    },
                                    {
                                        type: "text",
                                        text: data.gatewayName,
                                        size: "sm",
                                        color: "#111111",
                                        flex: 5,
                                        wrap: true,
                                    },
                                ],
                            },
                            {
                                type: "box",
                                layout: "baseline",
                                spacing: "sm",
                                contents: [
                                    {
                                        type: "text",
                                        text: "時間",
                                        size: "sm",
                                        color: "#999999",
                                        flex: 2,
                                    },
                                    {
                                        type: "text",
                                        text: timestamp,
                                        size: "sm",
                                        color: "#111111",
                                        flex: 5,
                                        wrap: true,
                                    },
                                ],
                            },
                        ],
                    },
                ],
            }, footer: {
                type: "box",
                layout: "vertical",
                spacing: "sm",
                paddingAll: "lg",
                contents: [
                    // 商家優惠內容（如果是商家且有優惠活動）
                    ...(data.isAD && (data.activityTitle || data.activityContent)
                        ? [
                            {
                                type: "separator",
                                margin: "lg",
                            },
                            {
                                type: "box",
                                layout: "vertical",
                                margin: "lg",
                                spacing: "lg",
                                paddingStart: "lg",
                                paddingEnd: "lg",
                                contents: [
                                    {
                                        type: "text",
                                        text: "商家優惠",
                                        size: "sm",
                                        color: "#666666",
                                        weight: "bold",
                                    },
                                    // 優惠標題
                                    ...(data.activityTitle
                                        ? [
                                            {
                                                type: "text",
                                                text: data.activityTitle,
                                                size: "md",
                                                weight: "bold",
                                                wrap: true,
                                                margin: "lg",
                                            },
                                        ]
                                        : []),
                                    // 優惠內容
                                    ...(data.activityContent
                                        ? [
                                            {
                                                type: "text",
                                                text: data.activityContent,
                                                size: "sm",
                                                color: "#666666",
                                                wrap: true,
                                                margin: "md",
                                            },
                                        ]
                                        : []),
                                ],
                            },
                            {
                                type: "separator",
                                margin: "lg",
                            },
                        ]
                        : []),
                    // 按鈕水平排列
                    {
                        type: "box",
                        layout: "horizontal",
                        spacing: "sm",
                        margin: "lg",
                        contents: [
                            {
                                type: "button",
                                style: "primary",
                                color: "#4ECDC4",
                                height: "sm",
                                action: {
                                    type: "uri",
                                    label: "查看地圖",
                                    uri: `https://www.google.com/maps?q=${data.latitude},${data.longitude}`,
                                },
                            },
                            // 店家資訊按鈕（如果是商家且有網站連結）
                            ...(data.isAD && data.websiteLink
                                ? [
                                    {
                                        type: "button",
                                        style: "secondary",
                                        height: "sm",
                                        action: {
                                            type: "uri",
                                            label: "店家資訊",
                                            uri: data.websiteLink,
                                        },
                                    },
                                ]
                                : []),
                        ],
                    },
                    {
                        type: "text",
                        text: "此通知由您設定的通知點自動發送",
                        size: "xs",
                        color: "#999999",
                        align: "center",
                        margin: "md",
                    },
                ],
            } }),
    };
    // 發送訊息
    await client.pushMessage(lineUserId, flexMessage);
};
exports.sendNotificationPointAlert = sendNotificationPointAlert;
//# sourceMappingURL=sendMessage.js.map