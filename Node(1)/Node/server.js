var express = require('express');
var app = express();
var http = require('http');
var httpServer = http.Server(app);

var bodyParser = require('body-parser');
var morgan = require('morgan');
var mongoose = require('mongoose');

var jwt = require('jsonwebtoken'); // used to create, sign, and verify tokens
var config = require('./config'); // get our config file
var User = require('./app/models/user'); // get our mongoose model
var apiRoutes = express.Router();

// =======================
// configuration =========
// =======================
var port = process.env.PORT || 3050; // used to create, sign, and verify tokens
var mongo = mongoose.connect(config.database); // connect to database
console.log(mongo);
app.set('superSecret', config.secret); // secret variable

// use body parser so we can get info from POST and/or URL parameters
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// use morgan to log requests to the console
app.use(morgan('dev'));
app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

app.use(express.static(__dirname + '/public'));

// =======================
// routes ================
// =======================
// basic route
app.get('/', function (req, res) {
  res.sendfile(__dirname + '/public/index.html?v=1');
});
app.get('/setup', function (req, res) {

  // create a sample user
  var nick = new User({
    name: 'Nick Cerminara',
    password: 'password',
    admin: true
  });

  // save the sample user
  nick.save(function (err) {
    if (err) throw err;

    console.log('User saved successfully');
    res.json({ success: true });
  });
});
apiRoutes.post('/users', function (req, res) {
  console.log(req.body.name);

  User.findOne({
    email: req.body.email
  }, function (err, user) {
    if (err) throw err;
    if (user) {
      res.json({ success: false, message: 'Email Already Exists' });
    } else {

      var user = new User({
        name: req.body.name,
        password: req.body.password,
        email: req.body.email
      });

      // save user
      user.save(function (err) {
        if (err) throw err;

        console.log('User saved successfully');
        res.json({ success: true });
      });
    }
  })
});

apiRoutes.post('/authenticate', function (req, res) {
  console.log(req.body);
  // find the user
  User.findOne({
    email: req.body.email
  }, function (err, user) {

    if (err) throw err;

    if (!user) {
      res.json({ success: false, message: 'Authentication failed. User not found.' });
    } else if (user) {
      console.log('User is ');
      console.log(user);
      // check if password matches
      if (user.password != req.body.password) {
        res.json({ success: false, message: 'Authentication failed. Wrong password.' });
      } else {

        // if user is found and password is right
        // create a token
        var token = jwt.sign(user, app.get('superSecret'), {
          expiresIn: 60 * 60 * 24 // expires in 24 hours
        });

        // return the information including token as JSON
        res.json({
          success: true,
          message: 'token',
          token: token,
          name: user.name
        });
      }

    }

  });
});

apiRoutes.use(function (req, res, next) {

  // check header or url parameters or post parameters for token
  var token = req.body.token || req.query.token || req.headers['x-access-token'];

  // decode token
  if (token) {

    // verifies secret and checks exp
    jwt.verify(token, app.get('superSecret'), function (err, decoded) {
      if (err) {
        return res.json({ success: false, message: 'Failed to authenticate token.' });
      } else {
        // if everything is good, save to request for use in other routes
        req.decoded = decoded;
        next();
      }
    });

  } else {

    // if there is no token
    // return an error
    return res.status(403).send({
      success: false,
      message: 'No token provided.'
    });

  }
});

// API ROUTES -------------------
apiRoutes.get('/', function (req, res) {
  res.json({ message: 'Welcome to the coolest API on earth!' });
});

// route to return all users (GET http://localhost:8080/api/users)
apiRoutes.get('/users', function (req, res) {
  if (req.query.id == undefined) {
    User.find({}, function (err, users) {
      console.log(users);
      res.json(users);
    });
  } else {
    User.find({_id:req.query.id}, function (err, users) {
      console.log(users);
      res.json(JSON.stringify(users[0]));
    });
  }
});



apiRoutes.put('/users', function (req, res) {
  console.log(req.body.name);
  var query = { '_id': req.body._id };
  User.findOneAndUpdate(query, req.body, { upsert: true }, function (err, doc) {
    if (err) return res.send(500, { error: err });
    return res.send("succesfully saved");
  });
});

/* DELETE /user/:id */
apiRoutes.delete('/users', function(req, res, next) {
  User.findByIdAndRemove(req.query.id, function (err, post) {
    if (err) return next(err);
    res.json(post);
  });
});

// apply the routes to our application with the prefix /api
app.use('/api', apiRoutes);
// we'll get to these in a second

// =======================
// start the server ======
// =======================
app.listen(port);
console.log('Magic happens at http://localhost:' + port);