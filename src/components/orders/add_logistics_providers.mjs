// 添加快递公司到数据库的脚本
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// 加载环境变量
config({ path: '.env.development' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('缺少Supabase配置信息');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function addLogisticsProviders() {
  try {
    console.log('正在添加快递公司数据到数据库...');
    
    const { data, error } = await supabase
      .from('logistics_providers')
      .upsert([
        { name: '顺丰速运', code: 'SF', contact_phone: '95338', average_delivery_time: 24, is_active: true },
        { name: '圆通速递', code: 'YTO', contact_phone: '95554', average_delivery_time: 48, is_active: true },
        { name: '中通快递', code: 'ZTO', contact_phone: '95311', average_delivery_time: 48, is_active: true },
        { name: '申通快递', code: 'STO', contact_phone: '95543', average_delivery_time: 48, is_active: true },
        { name: '韵达快递', code: 'YD', contact_phone: '95546', average_delivery_time: 48, is_active: true },
        { name: '京东物流', code: 'JD', contact_phone: '950616', average_delivery_time: 24, is_active: true },
        { name: '德邦快递', code: 'DP', contact_phone: '95353', average_delivery_time: 72, is_active: true },
        { name: 'EMS', code: 'EMS', contact_phone: '11183', average_delivery_time: 72, is_active: true },
        { name: '百世快递', code: 'HTKY', contact_phone: '95320', average_delivery_time: 72, is_active: true },
        { name: '极兔速递', code: 'JT', contact_phone: '400-821-2218', average_delivery_time: 48, is_active: true }
      ], { onConflict: 'code' });
    
    if (error) {
      console.error('添加快递公司数据失败:', error);
      process.exit(1);
    }
    
    console.log('✅ 快递公司数据已成功添加到数据库！');
    console.log(`已添加 ${data.length} 家快递公司`);
  } catch (error) {
    console.error('执行过程中发生错误:', error);
    process.exit(1);
  }
}

addLogisticsProviders();