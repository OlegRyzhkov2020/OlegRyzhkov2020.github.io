// Define variables needed:
// dimensions for map container
var width = 940,
    height = 500;

// create SVG element in the map container
var svg = d3.select("#worldmap")
    .append("svg")
    .attr('class','worldMapSvg')
    .attr("width", width)
    .attr("height", height)

var g = svg.append("g");
// define a geographical projection and set initial zoom
var projection =d3.geoNaturalEarth1().scale(1) // setting dummy scale than it is adjusted
// prepare a path object and apply the projection to it
var pathGenerator = d3.geoPath().projection(projection);
// prepare an object to later have easier access to the data
var dataById;
// scaling function for assigning colors to countries
// https://github.com/schnerd/d3-scale-cluster
var assignColor = d3.scaleCluster()
// creating the range of colors - colors defined in css
var colors= d3.range(6).map(i => ("country q" + i +"-10"));
// tooltip variable
var tooltip = d3.select("#worldmap")
    .append("div")
    .attr("class", "worldMapTooltip hidden");

// other global variables
var dataset;
var domain = [];
var years =d3.range(1990,2020);
var yearIndex = 0;
var currentYear = 1990;
var playing = false;
var countryName={};
var clusters=[];
/// ------------------------------------------------------

// LOAD ALL DATA AND AWAIT THE NEXT STEP
d3.queue()   // queue function loads all external data files asynchronously
//   .defer(d3.tsv, "data/110m.tsv")
  .defer(d3.json, "data/world-topo.json")  // our geometries, does not work with latest version of topojson countries data, probably different structure of data?
  .defer(d3.csv, "data/countries.csv")
  .defer(d3.csv, "data/cities.csv")
  .await(processData);


function processData(err, world, production, cities) {
    var curCity = 0;
    // save countries variable
    var countries = topojson.feature(world, world.objects.countries);
   // get the scale and center parameters from the features
    var scaleCenter = calculateScaleCenter(countries);

    // apply scale, center and translate parameters:
    projection.scale(scaleCenter.scale)
            .center(scaleCenter.center)
            .translate([width/2, height/2]);

    // assign data to variable
    dataset=production;

    // map the data from csv to dataById (all data):
    dataById = d3.nest()
        .key(d => d.country_code)
        .rollup(d => d[0])
        .map(dataset);

    // assign values only to domain for later scaling (only values, need to be cleaned for undefined and n/a)
    for (i in countries.features) {
        switch (dataById.get(countries.features[i].properties.id)) {
            case undefined:
                break;
            default:
                for (k in years) {
                    switch (isNaN(dataById.get(countries.features[i].properties.id)[years[k]])) {
                        case true:
                            break;
                        default:
                            domain.push(Math.round(dataById.get(countries.features[i].properties.id)[years[k]]));
                    };
                };
        };
    };

    // draw the sphere around the globe
    g.append('path')
        .attr('class', 'sphere')
        .attr('d', pathGenerator({type: 'Sphere'}));

    // make a globe/sphere to be responsive to zoom
    svg.call(d3.zoom().on('zoom', () => {
        g.attr('transform', d3.event.transform);
    }));

    // draw each country on the map
    g.selectAll('path')
        .data(countries.features)
        .enter().append('path')
        .attr('class', 'country')
        .attr('d', pathGenerator)
        // show tooltip when mouse move over the country DOES NOT WORK YET
        .on('mousemove', showTooltip)
        .on('mouseout', hideTooltip);

        // draw points
           g.selectAll("circle")
               .data(cities)
               .enter()
               .append("circle")
       		.attr("class","circles")
               .attr("cx", function(d) {return projection([d.Longitude, d.Lattitude])[0];})
               .attr("cy", function(d) {return projection([d.Longitude, d.Lattitude])[1];})
               .attr("r", 2)
               .style("fill", "black"),

        // add labels
           g.selectAll("text")
               .data(cities)
               .enter()
               .append("text")
       		.text(function(d) {
       			   		return d.City;
       			   })
       		.attr("x", function(d) {return projection([d.Longitude, d.Lattitude])[0] -10;})
       		.attr("y", function(d) {return projection([d.Longitude, d.Lattitude])[1] - 5;})
       		.attr("class","labels")
          .style("fill", "black");


    // data is created inside the function so it is always unique
    let repeat = () => {
        function getRandomInt(min, max) {
          min = Math.ceil(min);
          max = Math.floor(max);
          return Math.floor(Math.random() * (max - min)) + min; //Максимум не включается, минимум включается
          };

        var start = curCity;
        var finish = (curCity+1)%cities.length;
        curCity = finish;
        //var data = 1;


        var origin = [cities[start].Longitude, cities[start].Lattitude];
        var destination = [cities[finish].Longitude, cities[finish].Lattitude];
        // Create data: coordinates of start and end
        var link = {type: "LineString", coordinates: [origin, destination]} // Change these data to see ho the great circle reacts
        // A path generator
        var path = d3.geoPath()
          .projection(projection);

        g.selectAll(".cities").remove();

        // Add the path
        var path_route = g.append("path")
              .attr("d", path(link))
              .attr('class', 'cities')
              .attr("fill", "none")
              .attr("stroke", "darkred")
              .attr("stroke-width", 2);

        //path_route.selectAll("path").remove();

        path_route.transition()
                .attr("stroke-dasharray", 5 + " " + 5)
                .attr("stroke-dashoffset", 5)
                .duration(1000)
                .ease(d3.easeLinear)
                .attr("stroke-dashoffset", 0)
                .on("end", repeat);
    };
    repeat();


    // g.selectAll(".mark")
    //    .data(marks)
    //    .enter()
    //    .append("image")
    //    .attr('class','mark')
    //    .attr('width', 20)
    //    .attr('height', 20)
    //    .attr("xlink:href",'https://cdn3.iconfinder.com/data/icons/softwaredemo/PNG/24x24/DrawingPin1_Blue.png')
    //    .attr("transform", d => `translate(${projection([d.long,d.lat])}`);

    // call function to update colors
    updateMapColors();
    // drawMap();

};
// function to update map colors based on the values
function updateMapColors() {
    // updating our function for color scaling adding domain and range
    assignColor.domain(domain).range(colors);

    // assign colors to elements based on the values in particular year
    g.selectAll('.country')
     .attr('class', function(d) {
        switch (dataById.get(getId(d))) {
            case undefined:
                return 'country default';
                break;
            default:
                if (isNaN(dataById.get(getId(d))[currentYear])|dataById.get(getId(d))[currentYear]==0) {
                    return 'country default';
                } else {
            return assignColor(dataById.get(getId(d))[currentYear]);
        }};
    });
};

// creating a legend for data
// amazing source https://d3-legend.susielu.com/#symbol-ordinal
// Threshold legend
function drawLegend() {
    var legendSvgHeight = 300;
    var legendSvgWidth = 300;

    var legendSvg = d3.select('#legend')
    .append('svg')
    .attr('class', 'svgLegend')
    .attr("height", legendSvgHeight)
    .attr("width", legendSvgWidth);

    var thresholdScale = d3.scaleThreshold()
    .domain([ 471, 1227, 2059, 2822, 3689, 5651, 8207, 10269, 15360])
    .range(d3.range(10)
    .map(function(i) { return "q" + i + "-10"}));

    legendSvg.append("g")
    .attr("class", "legendQuant")
    .attr("transform", "translate(20,20)");

    var legend = d3.legendColor()
    .labelFormat(d3.format(",.0f"))
    // .orient('horizontal')
    .ascending(true)
    .shapeWidth(50)
    .shapeHeight(20)
    .title('Daily Oil Production (ths. barrels)')
    .labels(d3.legendHelpers.thresholdLabels)
    .labelWrap(150)
    .labelAlign('start') // options: 'start', 'middle', 'end'
    .useClass(true)
    .scale(thresholdScale);

    legendSvg.select(".legendQuant")
    .call(legend);
};

// function to animate map when hitting play button
function animateMap() {

    var timer;  // create timer object
    d3.select('#play')
      .on('click', function() {  // when user clicks the play button
        // console.log('click');
        if(playing == false) {  // if the map is currently playing
          timer = setInterval(function(){   // set a JS interval
            if(yearIndex < years.length-1) {
                yearIndex +=1;  // increment the current attribute counter
            } else {
                yearIndex = 0;  // or reset it to zero
            }
            currentYear = years[yearIndex];
            updateMapColors();  // update the representation of the map
            d3.select('#output').html(years[yearIndex]);  // update the clock
          }, 600); // 600 is the interval for change

          d3.select(this).html('stop');  // change the button label to stop
          playing = true;   // change the status of the animation
        } else {    // else if is currently playing
          clearInterval(timer);   // stop the animation by clearing the interval
          d3.select(this).html('play');   // change the button label to play
          playing = false;   // change the status again
        }
    });
  };

// function to make map responsive to slider - choosing specific year
(function() {
    // select the output
    var output = d3.select("#output");

    // select range
    d3.select('#sequence')
        .on('input', function(d) { // when it changes
            currentYear = +this.value;
            updateMapColors(); // update  the map
            output.html(+this.value)  // update the output
        });
})();

// tooltip function - for showing name and data - NEED TO BE ADJUSTED
function showTooltip(f) {
    tooltip.classed('hidden', false)
        .html(getId(f)+': '+ d3.format(",.0f")(Math.round(+dataById.get(getId(f))[currentYear])))
            .style('left', d3.event.pageX+'px')
            .style('top', d3.event.pageY+'px');
};

function hideTooltip() {
    tooltip.classed('hidden', true);
};

// helpers functions:
function getId(f) {
    return f.properties.id;
};

/**
 * source: https://data-map-d3.readthedocs.io/en/latest/index.html#
 * Calculate the scale factor and the center coordinates of a GeoJSON
 * FeatureCollection. For the calculation, the height and width of the
 * map container is needed.
 *
 * Thanks to: http://stackoverflow.com/a/17067379/841644
 *
 * @param {object} features - A GeoJSON FeatureCollection object
 *   containing a list of features.
 *
 * @return {object} An object containing the following attributes:
 *   - scale: The calculated scale factor.
 *   - center: A list of two coordinates marking the center.
 */
function calculateScaleCenter(countries) {
    // Get the bounding box of the paths (in pixels!) and calculate a
    // scale factor based on the size of the bounding box and the map
    // size.
    var bbox_path = pathGenerator.bounds(countries),
        scale = 0.95 / Math.max(
        (bbox_path[1][0] - bbox_path[0][0]) / width,
        (bbox_path[1][1] - bbox_path[0][1]) / height
        );

    // Get the bounding box of the features (in map units!) and use it
    // to calculate the center of the features.
    var bbox_feature = d3.geoBounds(countries),
        center = [
        (bbox_feature[1][0] + bbox_feature[0][0]) / 2,
        (bbox_feature[1][1] + bbox_feature[0][1]) / 2];

    return {
    'scale': scale,
    'center': center
    };
};

drawLegend();
animateMap();
