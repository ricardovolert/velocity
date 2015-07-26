// Populate the canvases with IDs x_canvas, v_canvas, and a_canvas with graphs of position, velocity, and acceleration
// measuring the motion of the mouse.

(function() {

  function filled_array(size,fill_value) {
    // http://stackoverflow.com/a/13735425/1142217
    return Array.apply(null, Array(size)).map(Number.prototype.valueOf,fill_value);
  }

  function display_message(m) {
    document.getElementById("message").innerHTML = m;
  }
  var graphing_is_active = true;
  var interval_id = -1; // for setInterval and clearInterval
  var all_graphs = [];
  function stop_graphing() {
    graphing_is_active = false;
    display_message("Click in one of the graphs to erase them and make another set.");
    if (interval_id != -1) {clearInterval(interval_id);}
  }
  function start_graphing() { // called by initialize() and also when you click to restart graphing
    graphing_is_active = true;
    display_message("Put the mouse cursor in the position graph and move it up and down.");
    interval_id = setInterval(handle_interval_timer,TIME_INTERVAL);
    for (var i=0; i<all_graphs.length; i++) {
      var g = all_graphs[i];
      g.last_valid_time = -1;
      redraw(g,true);
    }
  }

  var TIME_INTERVAL = 3; // milliseconds; this is how often we sample the mouse's position and plot a new point

  var BUFFER_SIZE = 1000; // number of data-points to be graphed, which is smaller than the number collected, due to filtering
                          // don't access this directly; use this.raw_buffer_size and this.cooked_buffer_size
  var clock = 0; // shared by all Graph objects; is an index into data buffers
                 // represents how much data we've actually acquired, not how much we've graphed; these differ because
                 //         we have a moving window for filtering
                 // ranges from 0 to this.raw_buffer_size-1
                 // can be interpeted as time in time in units of TIME_INTERVAL
  var Graph = function(args) {
    this.canvas_id = args.id;
    this.smoothing = args.smoothing; // radius of window for acausal filtering
    this.prescale = args.prescale;
    this.end_sweep = args.end_sweep; // a function to call back to when we have swept to the right edge of the screen
    this.color = args.color;
    this.line_width = args.line_width;
    this.variable = args.variable; // string to use as a label on the axis for the dependent variable
    // circular buffer
    this.raw_buffer_size = BUFFER_SIZE+2*this.smoothing;
    this.cooked_buffer_size = BUFFER_SIZE;
    this.raw_data = filled_array(this.raw_buffer_size,0); // before low-pass filtering
    this.data = filled_array(this.cooked_buffer_size,0); // after low-pass filtering
    this.last_valid_time = -1; // no valid data yet
    this.canvas = document.getElementById(this.canvas_id);

    this.canvas.contentEditable=true; // make it able to take keyboard focus
    this.canvas.addEventListener('mouseover',function (event) {
      event.target.focus(); // give it the focus whenever the mouse moves over it
    },false);
    this.canvas.addEventListener('mouseout',function (event) {
      event.target.blur();
    },false);

    this.context = this.canvas.getContext('2d');
    this.canvas_w = this.context.canvas.width;
    this.canvas_h = this.context.canvas.height;
    this.new_data_point = function (raw) { // to fit on graph, d should range from -1 to 1
      if (!graphing_is_active) {return;}
      var d = raw*this.prescale;
      this.raw_data[clock] = d;
      if (clock>=2*this.smoothing) { // we've accumulated enough raw data to start producing filtered data
        var r = this.smoothing; // radius of window
        var norm = 0;
        var avg = 0;
        for (var i=clock-2*r; i<=clock; i++) {
          var weight = Math.abs(i-clock); // triangular shape
          // var weight = 1; // square shape
          norm = norm+weight;
          avg = avg+weight*this.raw_data[i];
        }
        avg = avg/norm;
        this.data[clock-r] = avg;
        this.last_valid_time=clock-r;
      }
      if (clock+1==this.raw_buffer_size-1) { // we've reached the end of a sweep
        if (this.end_sweep!==undefined) {this.end_sweep();}
      }
      redraw(this,false);
    };
  };
  var position =     new Graph({id:'x_canvas',smoothing:1,prescale:1.0,color:'blue',line_width:2,variable:"x",
                           end_sweep:function() {stop_graphing()}});
  var velocity =     new Graph({id:'v_canvas',smoothing:10,prescale:16.0,color:'red',line_width:2,variable:"v"});
  var acceleration = new Graph({id:'a_canvas',smoothing:20,prescale:2,color:'green',line_width:2,variable:"a"});
  all_graphs = [position,velocity,acceleration];

  var current_mouse_y = 0; // expressed such that 1.0=top of canvas, -1.0=bottom
  var t = 0;

  function attach_event_listeners_to_a_graph(graph) {
    graph.canvas.addEventListener('click',handle_click,false);
  }

  function initialize() {
    window.addEventListener('resize',handle_resize_canvas,false);
    handle_resize_canvas(); // Draw canvas border for the first time.
    position.canvas.addEventListener('mousemove',handle_mouse_move,false);
    attach_event_listeners_to_a_graph(position);
    attach_event_listeners_to_a_graph(velocity);
    start_graphing();
  }

  initialize();

  function handle_interval_timer() {
    t = t + TIME_INTERVAL;
    var previous_time = clock-1;
    var previous_y = current_mouse_y;
    if (previous_time>=0) {previous_y = position.raw_data[previous_time];}
    position.new_data_point(current_mouse_y);
    var current_v = current_mouse_y-previous_y;
    velocity.new_data_point(current_v);
    var previous_v = current_v;
    if (previous_time>=0) {previous_v = velocity.raw_data[previous_time];}
    // acceleration.new_data_point(current_v-previous_v);
    acceleration.new_data_point(velocity.raw_data[clock]-velocity.raw_data[clock-5]);
    clock = clock+1;
    if (clock>position.raw_buffer_size-1) {clock=0}
  }
    
  function redraw(graph,is_from_scratch) {
    graph.canvas_w = graph.context.canvas.width;
    graph.canvas_h = graph.context.canvas.height;

    if (is_from_scratch) {
      graph.context.clearRect(0, 0, graph.canvas_w, graph.canvas_h);
      // draw vertical grid lines
      graph.context.beginPath();
      graph.context.strokeStyle = '#eeeeee';
      graph.context.lineWidth = 1;
      var ngrid = 30;
      for (var i=0; i<ngrid; i++) {
        var x = graph.canvas_w*i/ngrid;
        graph.context.moveTo(x,0);
        graph.context.lineTo(x,graph.canvas_h);
        graph.context.stroke();
      }
      graph.context.font = '30px Arial'; // apparently there's no way to get around hardcoding the font name?? -- http://stackoverflow.com/questions/18092753/change-font-size-of-canvas-without-knowing-font-family
      // draw t axis
      graph.context.beginPath();
      graph.context.strokeStyle = 'black';
      graph.context.lineWidth = 1;
      graph.context.moveTo(0,0.5*graph.canvas_h);
      graph.context.lineTo(graph.canvas_w,0.5*graph.canvas_h);
      graph.context.stroke();
      graph.context.fillText("t",graph.canvas_w-20,0.5*graph.canvas_h+20);
      // draw axis for dependent variable
      graph.context.moveTo(1,0);
      graph.context.lineTo(1,graph.canvas_h);
      graph.context.stroke();
      graph.context.fillText(graph.variable,5,20);
    }
    graph.context.beginPath();
    var cx = graph.canvas_w/2;
    var cy = graph.canvas_h/2;
    var x_scale = graph.canvas_w/graph.cooked_buffer_size;
    var y_scale = 0.5*graph.canvas_h;
    function transform_y(y) {return y_scale*(1.0-y)}
    var start_at = graph.last_valid_time;
    if (is_from_scratch) {start_at=1;}
    for (var i=start_at; i<=graph.last_valid_time; i++) {
      var x = i*x_scale;
      var y1 = graph.data[i-1];
      var y2 = graph.data[i];
      graph.context.strokeStyle = graph.color;
	  graph.context.lineWidth = graph.line_width;
      graph.context.moveTo(x,transform_y(y1));
      graph.context.lineTo(x+x_scale,transform_y(y2));
      graph.context.stroke();
    }
  }

  function handle_resize_canvas() {
    for (var i=0; i<all_graphs.length; i++) {
      var g = all_graphs[i];
      g.last_valid_time = -1;
      g.canvas.width = window.innerWidth;
      g.canvas.height = window.innerHeight/2;
      redraw(g,true);
    }
  }

  function handle_click(event) {
    // console.log("got click");
    if (!graphing_is_active) {start_graphing();}
  }

  function get_mouse_y(canvas, event) {
    // Return the current y position of the mouse, expressed relative to the canvas, with -1 being the bottom and 1 the top.
    // Judging from complicated and inconclusive online discussions, this seems to be difficult to do in a browser-independent
    // and robust way. The following seems to work in firefox, chrome, and modern IE.
    var rect = canvas.getBoundingClientRect();
    var y_raw = event.clientY - rect.top;
    return 1.0-2.0*y_raw/rect.height; // force it into [-1,1] range
  }

  function handle_mouse_move(event) {
    current_mouse_y = get_mouse_y(position.canvas, event);
  }


})();