// Synthetic deterministic weekend for browser behavior. Never presented as
// real driver performance. Recorded contract samples live under src/services.
export async function mockQualifying(page,{missing=false} = {}) {
  await page.route('https://api.openf1.org/v1/**',async route => {
    const url=new URL(route.request().url());
    const endpoint=url.pathname.split('/').pop();
    const start='2024-01-01T12:00:00.000Z';
    const laps=[{driver_number:1,lap_number:1,lap_duration:90,date_start:start,duration_sector_1:30,duration_sector_2:30,duration_sector_3:30},{driver_number:2,lap_number:2,lap_duration:91,date_start:start,duration_sector_1:30.2,duration_sector_2:30.7,duration_sector_3:30.1}];
    const driver=Number(url.searchParams.get('driver_number')) || 1;
    const duration=driver===1?90:91;
    const samples=Array.from({length:50},(_,i) => {
      const angle=i/49*Math.PI*2;
      return {date:new Date(Date.parse(start)+i/49*duration*1000).toISOString(),x:1000+Math.cos(angle)*500,y:1000+Math.sin(angle)*400,speed:150+i,throttle:80,brake:0,drs:8,n_gear:5,rpm:10000};
    });
    const data={
      sessions:missing?[]:[{session_key:9001,meeting_key:100,session_type:'Qualifying',session_name:'Qualifying',date_start:start},{session_key:9002,meeting_key:100,session_type:'Race',session_name:'Race',date_start:'2024-01-02T12:00:00Z'}],
      laps:url.searchParams.get('session_key')==='9002'?[{...laps[0],lap_number:60}]:laps,
      drivers:[{driver_number:1,full_name:'Driver One',team_name:'Team One'},{driver_number:2,full_name:'Driver Two',team_name:'Team Two'}],
      location:samples,car_data:samples,stints:[],pit:[],race_control:[],weather:[],
    }[endpoint] || [];
    await route.fulfill({json:data});
  });
}
