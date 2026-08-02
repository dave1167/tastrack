(function () {
    'use strict';

    document.addEventListener('DOMContentLoaded', function () {
        if (typeof window.io !== 'function') return;

        function loadServerConnect(id) {
            const element = document.getElementById(id);
            if (!element || !element.dmxComponent || !window.dmx) return;
            window.dmx.parse(id + '.load()');
        }

        function refreshChat(message) {
            const params = new URLSearchParams(window.location.search);
            const isOpenConversation =
                window.location.pathname === '/chat' &&
                (!message ||
                 params.get('user') === String(message.senderUserId) ||
                 params.get('user') === String(message.recipientUserId));

            try {
                if (isOpenConversation) {
                    loadServerConnect('scDirectMessages');
                }
                const drawerRecipient = document.getElementById('chatDrawerRecipient');
                const isOpenDrawerConversation = drawerRecipient && drawerRecipient.value &&
                    (!message ||
                     drawerRecipient.value === String(message.senderUserId) ||
                     drawerRecipient.value === String(message.recipientUserId));
                if (isOpenDrawerConversation) {
                    loadServerConnect('scChatDrawerMessages');
                }
                loadServerConnect('scChatUsers');
                loadServerConnect('scChatDrawerUsers');
                loadServerConnect('scHeaderNotifications');
                loadServerConnect('scHeaderChat');
            } catch (error) {
                console.warn('Chat refresh was deferred.', error);
            }
        }

        const socket = window.io({
            transports: ['websocket', 'polling'],
            withCredentials: true
        });

        socket.on('chat:message', function (message) {
            refreshChat(message);
        });

        socket.on('connect', function () {
            document.documentElement.dataset.chatSocket = 'connected';
        });

        socket.on('connect_error', function () {
            document.documentElement.dataset.chatSocket = 'disconnected';
        });

        const apiSocket = window.io('/api', {
            transports: ['websocket', 'polling'],
            withCredentials: true
        });

        apiSocket.on('chat:changed', function () {
            refreshChat();
        });


        if (new URLSearchParams(window.location.search).get('chat') === 'open') {
            const drawer = document.getElementById('chatDrawer');
            if (drawer && window.bootstrap && window.bootstrap.Offcanvas) {
                window.bootstrap.Offcanvas.getOrCreateInstance(drawer).show();
            }
        }
    });
}());
