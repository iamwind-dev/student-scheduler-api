/**
 * Test getOrCreateUserId function directly
 */

require('dotenv').config();
const { ScheduleService } = require('./src/services/schedule-service');

async function test() {
    const service = new ScheduleService();
    
    try {
        console.log('🧪 Testing getOrCreateUserId...\n');
        
        const userData = {
            email: 'langph.22it@vku.udn.vn',
            name: 'Lang Phan',
            studentId: '22IT001',
            role: 'Student'
        };
        
        console.log('Input:');
        console.log('  userIdentifier:', 'langph.22it@vku.udn.vn');
        console.log('  userData:', userData);
        
        const userId = await service.getOrCreateUserId('langph.22it@vku.udn.vn', userData);
        
        console.log('\n✅ Result:');
        console.log('  UserId:', userId);
        console.log('  Type:', typeof userId);
        
    } catch (error) {
        console.error('\n❌ Error:', error.message);
        console.error('Full error:', error);
    }
}

test();
