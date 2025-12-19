/**
 * Test createSchedule function directly
 */

require('dotenv').config();
const { ScheduleService } = require('./src/services/schedule-service');

async function test() {
    const service = new ScheduleService();
    
    try {
        console.log('🧪 Testing createSchedule...\n');
        
        const userIdentifier = 'langph.22it@vku.udn.vn';
        const scheduleName = 'Test Schedule - Direct';
        const courses = [
            {
                courseId: 1,
                courseName: 'Lập trình Web',
                courseCode: 'IT4409',
                credits: 3,
                lecturer: 'Nguyễn Văn A',
                time: 'Thứ 2 | Tiết 1->3',
                room: 'TC-205',
                weeks: '1-15',
                quantity: 120
            }
        ];
        const userData = {
            email: 'langph.22it@vku.udn.vn',
            name: 'Lang Phan',
            studentId: '22IT001',
            role: 'Student'
        };
        
        console.log('Input:');
        console.log('  userIdentifier:', userIdentifier);
        console.log('  scheduleName:', scheduleName);
        console.log('  courses:', courses.length);
        console.log('  userData:', userData);
        
        const result = await service.createSchedule(userIdentifier, scheduleName, courses, userData);
        
        console.log('\n✅ Result:');
        console.log(JSON.stringify(result, null, 2));
        
    } catch (error) {
        console.error('\n❌ Error:', error.message);
        console.error('Stack:', error.stack);
    }
}

test();
