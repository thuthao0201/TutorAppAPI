const axios = require('axios');
require('dotenv').config();

const createZoomMeeting = async (classData) => {
    try {
        // Cấu hình API Zoom với OAuth
        const zoomConfig = {
            accountId: process.env.ZOOM_ACCOUNT_ID,
            clientId: process.env.ZOOM_CLIENT_ID,
            clientSecret: process.env.ZOOM_CLIENT_SECRET
        };

        // Bước 1: Lấy access token
        // Base64 encode client_id:client_secret (được thực hiện tự động bởi axios)
        const tokenResponse = await axios.post(
            'https://zoom.us/oauth/token',
            {
                grant_type: 'account_credentials',
                account_id: zoomConfig.accountId
            },
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                auth: {
                    username: zoomConfig.clientId,
                    password: zoomConfig.clientSecret
                }
            }
        );

        const accessToken = tokenResponse.data.access_token;

        // Bước 2: Sử dụng access token để tạo cuộc họp
        const response = await axios.post(
            'https://api.zoom.us/v2/users/me/meetings',
            {
                topic: `Buổi học ${ classData.subject } - Lớp ${ classData.grade }`,
                type: 1, // Cuộc họp theo lịch
                start_time: Date.now() + 1000 * 60 * 1, // Thời gian bắt đầu cuộc họp (5 phút sau)
                duration: classData.duration,
                timezone: 'Asia/Ho_Chi_Minh',
                settings: {
                    host_video: false,
                    participant_video: true,
                    join_before_host: true,
                    approval_type: 0,
                    auto_recording: "cloud",
                    jbh_time: 5,
                    waiting_room: false,
                    // alternative_hosts: "trung.hoang.12.2002@gmail.com",
                }
            },
            {
                headers: {
                    'Authorization': `Bearer ${ accessToken }`,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log(response.data);


        return {
            roomId: response.data.id,
            joinUrl: response.data.join_url
        };
    } catch (error) {
        console.error('Lỗi khi tạo cuộc họp Zoom:', error.response?.data || error.message);
        throw error;
    }
};

createZoomMeeting({
    subject: 'Toán học',
    grade: '10',
    startDate: '2023-10-01T10:00:00Z',
    duration: 60
})
    .then(meeting => {
        console.log('Cuộc họp Zoom đã được tạo thành công:', meeting);
    })
    .catch(error => {
        console.error('Lỗi khi tạo cuộc họp Zoom:', error);
    });

