const appId = config.appId;
const host = 'developer.trimet.org'
const path = '/ws/V1/arrivals'
const query = `locIDs=6849&appID=${appId}`
var stopList = [];
var options = {
  hour: 'numeric',
  minute: 'numeric',
  hour12: true
};
let arrRequest = {
  protocol: 'https',
  host: 'developer.trimet.org',
  path: 'ws/V1/arrivals',
  params: {
    locID: 0,
    appId: appId,
    json: true,
  },
  get query(){
    return `locIDs=${this.params.locID}&appID=${this.params.appId}&json=${this.params.json}`
  },
  get url(){
    return `${this.protocol}://${this.host}/${this.path}?${this.query}`
  },
  set locID(num){
    this.params.locID = num
  }
}

let vehRequest = {
  protocol: 'https',
  host: 'developer.trimet.org',
  path: 'ws/V2/vehicles',
  params: {
    appId: appId,
    onRouteOnly: true,
    line: 0,
  },
  get query(){
    return `appID=${this.params.appId}&onRouteOnly=${this.params.onRouteOnly}`
  },
  get url(){
    return `${this.protocol}://${this.host}/${this.path}?${this.query}`
  },
  get stopsUrl(){
    return `${this.protocol}://${this.host}/${this.path}?${this.stopsQuery}`
  },
  get stopsQuery(){
    return `appID=${this.params.appId}&routes=${this.params.line}&onRouteOnly=${this.params.onRouteOnly}`
  },
  set lines(line){
    this.params.line = parseInt(line);
  },
  get lines(){
    return this.params.line;
  },
}

let routeRequest = {
  protocol: 'https',
  host: 'developer.trimet.org',
  path: 'ws/V1/routeConfig',
  params: {
    appId: appId,
    onRouteOnly: true,
    route: 0,
    json: true,
    dir: true,
    stops: true,
  },
  get query(){
    return `appID=${this.params.appId}&routes=${this.params.route}&json=${this.params.json}&dir=${this.params.dir}&stops=${this.params.stops}`
  },
  get url(){
    return `${this.protocol}://${this.host}/${this.path}?${this.query}`
  },
  get route(){
    return this.params.route;
  },
  set route(routeNum){
    this.params.route = parseInt(routeNum);
  }
}

function getDirections(routeNum){
  routeRequest.route = routeNum;
  stopList=[];
  clearResults();
  return getPromise(routeRequest.url)
  .then(response => response.json())
  .then(resultSet => resultSet.resultSet)
  .then(resultSet => {
    stopList.push(resultSet.route[0].dir[0].stop)
    stopList.push(resultSet.route[0].dir[1].stop)
    return [resultSet.route[0].dir[0].desc,resultSet.route[0].dir[1].desc]
  })
  .then(dirs => {
    populateDropDown(dirs, "direction", true)
    $("#direction").css("visibility", "visible")
    return dirs
  })
}

function getStopNames(){
  clearResults();
  dir = ($("#direction option:selected").data("index"))
  stopList = stopList[dir];
  stopList = stopList.map(item => {
    return `${item.locid} - ${item.desc}`
  })
  populateDropDown(stopList, "stops");
}

function getResults(stop){
  locID = stop.substr(0,stop.indexOf(" "));
  arrRequest.locID = locID;
  getPromise(arrRequest.url)
  .then(response => response.json())
  .then(resultSet =>
    {
    console.log(resultSet.resultSet.arrival)
    return resultSet.resultSet.arrival[0]
  })
  .then(bus => {
    busResults = {
      scheduled: bus.scheduled,
      estimated: bus.estimated,
      departed: bus.departed,
      destDist: bus.blockPosition.feet,
    }
    calculateResults(busResults);
  })
}

function calculateResults(busObj){
  clearResults();
  est=new Date(busObj.estimated);
  sched=new Date(busObj.scheduled)
  addArrTime(est.toLocaleString('en-US',options));
  if(!busObj.departed){
    addDeparted();
  }
  else{
    addLateTime(est,sched);
  }
  addFeet(busObj.destDist);
}

function clearResults(){
  $("#results").empty();
}

function addArrTime(est){
  $("#results").append(`<h2>Your bus should arrive at ${est}</h2>`);
}

function addLateTime(est,sched){
  minsLate = Math.floor((Date.parse(est) - Date.parse(sched)) /60000);
  $("#results").append(`<h2>It is currently ${minsLate} minute${(minsLate == "1" || minsLate == "-1") ? "" : "s"} ${minsLate < 0 ? "early!" : "late."}</h2>`);
}

function addDeparted(){
  $("#results").append(`<p>Your bus has not yet departed from its first stop, check again soon to see how late it is.</p>`)
}

function addFeet(feet){
  $("#results").append(`<h4>In case you were wondering, it is exactly ${feet} feet away from your stop.</h4>`);
}

function getVehicleList(){
  return getPromise(vehRequest.url)
  .then(response => response.json())
  .then(resultSet => resultSet.resultSet.vehicle)
  .then(vehicleList => {
    return splitList(vehicleList)
  })
  .then(busRailList => {
    return getLines(busRailList[1])
  })
}

function getLines(list)
{
  var uniqueList = [];
  if(list[0].signMessageLong.substr(0,3) == "MAX"){
    list.forEach(function(elem){
      if(!uniqueList.includes(elem.signMessage)){
        uniqueList.push(elem.signMessage); }
    });
  }
  else{
    list.forEach(function(elem){
      busMsg = elem.signMessageLong;
      busLine = busMsg.substr(0,busMsg.indexOf(' '));
      if(!uniqueList.includes(busLine)){
        uniqueList.push(busLine); }
    });
  }
  return uniqueList;
}

function resetDropDown(elem){
}

function populateDropDown(list, elem, index){
  $(`#${elem} option`).slice(1).remove();
  for(i=0;i<list.length;i++){
    var item = list[i];
    var opt = document.createElement("option");
    opt.textContent = item;
    opt.value = item;
    if(index){
      opt.setAttribute("data-index", i);
    }
    $(`#${elem}`).append(opt);
  }
}


function splitList(vehicleList){
  var railList = []
    , busList = [];
  vehicleList = vehicleList.filter(vehicle => vehicle.lastLocID!= null);
    vehicleList.forEach(function(vehicle) {
      if(vehicle.type == "rail")
      {railList.push(vehicle);}
      else{busList.push(vehicle);}
    });
    combinedList = [railList,busList];
    return combinedList;
}

function getPromise(url){
  return window.fetch(url);
}

function minutesFromNow(timestamp){
  return Math.floor((Date.parse(timestamp) - Date.now()) / 3600)
}

$(document).ready(function (){
  //populateChart();
  //populateScatterplot();
  getVehicleList().then(list => {
    list = list.sort((a,b) => a - b)
    populateDropDown(list, "lines")
  });
  // populateDropDown(lines);

});
