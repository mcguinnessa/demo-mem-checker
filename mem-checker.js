const db_tools = require('./mongo_tools');
const {MongoClient} = require('mongodb');

const DAY_S = 24 * 60 * 60;
const DAY_MS = DAY_S * 1000;
const HOUR_MS = 60 * 60 * 1000;
const INTERVAL_S = 60 * 60;
const INTERVAL_MS = INTERVAL_S * 1000;

const max_mem = 99;
const min_mem = 6;
const normal_high = 21;
const spike_peak = 50;
var spike = 0;

const free_space = 23;
var mem_usage = min_mem;

//nst hourly_weighting = [1, 2, 3, 4, 5, 6, 7, 8, 9 10, 11, 12, 13, 14 ,15, 16, 17, 18, 19, 20, 21, 22, 23, 24]
const hourly_weighting = [1, 2, 1, 1, 1, 1, 2, 2, 5,  7,  8,  9, 10, 10, 10,  9,  7,  5,  5,  5,  5,  3,  2,  1]


function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function getValue(a_timestamp){
  var record_hour = a_timestamp.getHours();
  weighting = hourly_weighting[record_hour % 24];

//  const ceiling = (max_mem / 10) * weighting;
//  var mem_usage = min_mem + Math.floor(Math.random() * ceiling);
	//
  if (91 <= Math.floor(Math.random() * 100)){
    console.log("Free Mem");
    mem_usage -= free_space;
  }

  if (spike == 0 ) {
    if (96 <= Math.floor(Math.random() * 100)){
      console.log("Spike Mem");
      spike = Math.floor(Math.random() * ((spike_peak / 10) * weighting))
    }
  } else if (spike > 0){
     spike = 0 - spike;
  } else {
     spike = 0
  }
  mem_usage = min_mem + (Math.floor(Math.random() * (((normal_high - min_mem) / 10 ) * weighting)))
  mem_usage += spike

//  incr = (Math.floor(Math.random() * (((30 / 10) * weighting) ))) - 3;
//  mem_usage += incr;
  if (mem_usage > max_mem) {mem_usage = max_mem;}
  if (mem_usage < min_mem) {mem_usage = min_mem;}

  //mem_usage = min_mem + Math.floor(Math.random() * (((max_mem - min_mem) / 10) * weighting))


  //console.log("TIME:" + a_timestamp + " HOUR:" + record_hour + " WEIGHTING:" + weighting + " INCR:" + incr + " MEM:" + mem_usage);
  console.log("TIME:" + a_timestamp + " HOUR:" + record_hour + " WEIGHTING:" + weighting +" SPIKE:" + spike + " MEM:" + mem_usage);
  return mem_usage;
}

async function run(){

  const uri = await db_tools.get_url();
  console.log("URI");
  console.log(uri);
  const client = new MongoClient(uri);


  try {
    const database = client.db(db_tools.DB_NAME);
    const metric_record = database.collection(db_tools.COLLECTION_NAME);
    var now = new Date();
    //var now_ms = now.getTime();

//    metric_record.deleteMany({"$and": [{timestamp: {"$lt": now }}, { "memUsage": {$exists : true } }]} , (err, d_res) => {
//      if (err) throw err;
//      console.log("Delete:" + d_res.deleteCount);
//    })

    const d_res = await metric_record.deleteMany({"$and": [{timestamp: {"$lt": now }}, { "memUsage": {$exists : true } }]} )
    console.log("Delete:" + d_res.deletedCount);

    var last_week = new Date(now - (DAY_MS * 7));
    var date_record = last_week;
    console.log("Last Week:" + last_week)


    while (date_record <= now){

      mem_usage = await getValue(date_record); 

      const doc = {
        timestamp: date_record,
        "memUsage": mem_usage,
      }  

      const result = await metric_record.insertOne(doc);
      //console.log(`A document was inserted with the _id: ${result.insertedId}` + " MEM:" + mem_usage);
	    
      date_record = new Date(date_record.getTime() + INTERVAL_MS);
    }

    while (true) {
       console.log("Sleeping for " + INTERVAL_MS)
       await sleep(INTERVAL_MS);
       var right_now = new Date();
       mem_usage = await getValue(right_now);
       const doc = {
         timestamp: right_now,
         "memUsage": mem_usage,
       }  

       const result = await metric_record.insertOne(doc);
       console.log(`A document was inserted with the _id: ${result.insertedId}` + " MEM:" + mem_usage);
    }

  } finally {
    await client.close();
  }
}
run().catch(console.dir);
