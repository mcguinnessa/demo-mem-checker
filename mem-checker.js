const db_tools = require('./mongo_tools');
const {MongoClient} = require('mongodb');

const DAY_S = 24 * 60 * 60;
const DAY_MS = DAY_S * 1000;
const HOUR_MS = 60 * 60 * 1000;
const INTERVAL_S = 30 * 60;
const INTERVAL_MS = INTERVAL_S * 1000;

const max_mem = 87;
const min_mem = 8;

//nst hourly_weighting = [1, 2, 3, 4, 5, 6, 7, 8, 9 10, 11, 12, 13, 14 ,15, 16, 17, 18, 19, 20, 21, 22, 23, 24]
const hourly_weighting = [1, 2, 1, 1, 1, 1, 2, 2, 5,  7,  8,  9, 10, 10, 10,  9,  7,  5,  5,  5,  5,  3,  2,  1]


function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function getValue(a_timestamp){
  var record_hour = a_timestamp.getHours();
  weighting = hourly_weighting[record_hour];

  const ceiling = (max_mem / 10) * weighting;
  var mem_usage = min_mem + Math.floor(Math.random() * ceiling);

  console.log("TIME:" + a_timestamp + " HOUR:" + record_hour + " WEIGHTING:" + weighting + " CEILING:" + ceiling + " MEM:" + mem_usage);
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

    var yesterday = new Date(now - DAY_MS);
    var date_record = yesterday;
    console.log("Yesterday:" + yesterday)

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
