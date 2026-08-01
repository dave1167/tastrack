const cookieParser = require('cookie-parser');
const config = require('../../../lib/setup/config');
const session = require('../../../lib/setup/session');

exports.handler = function (io) {
    io.use((socket, next) => {
        const response = {
            getHeader: () => undefined,
            setHeader: () => undefined,
            writeHead: () => undefined,
            end: () => undefined
        };

        cookieParser(config.secret)(socket.request, response, () => {
            session(socket.request, response, () => {
                const userId = Number(socket.request.session && socket.request.session.USER_ID);
                const tenantId = Number(socket.request.session && socket.request.session.TENANT_ID);

                if (!userId || !tenantId) {
                    return next(new Error('Authentication required.'));
                }

                socket.data.userId = userId;
                socket.data.tenantId = tenantId;
                next();
            });
        });
    });

    io.on('connection', socket => {
        socket.join(`user:${socket.data.userId}`);
    });
};
