
//Load Logic-Solver for SAT Checking
var Logic = require('logic-solver');
var express = require('express');
var bodyParser = require('body-parser')

const app = express();
const port = 3000;


app.use(express.static('public'));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded());


var person = ["Mustard","Scarlet","Plum","Green","White","Peacock"]
var place = ["Billiard Room", "Study", "Hall", "Lounge", "Dining Room", "Ball Room", "Conservatory", "Library", "Kitchen"]
var thing = ["Rope", "Lead Pipe", "Knife", "Wrench", "Candlestick", "Revolver"]
var all = person.slice().concat(place.slice()).concat(thing.slice());

var solver = new Logic.Solver();

solver.require(Logic.atMostOne("Alice", "Bob"));
solver.require(Logic.or("Bob", "Charlie"));
//solver.require("Alice");
var sol1 = solver.solve();

//console.log(sol1.getTrueVars());

//Mustard,Scarlet,Plum,Green,White,Peacock,Billiard Room,Study,Hall,Lounge,Dining Room,Ball Room,Conservatory,Library,Kitchen,Rope,Lead Pipe,Knife,Wrench,Candlestick,Revolver
var opponents = ["Opponent1", "Opponent2", "Opponent3"] ;//input - clockwise
var user = "Me";


// -Mustard_Me AND -Mustard_Opponent1 AND -Mustard_Opponent2 AND -Mustard_Opponent3 -> Mustard_POT (If no one has the card, then it must be in the POT)
// exactlyOne will be easier




class ClueSolver {
	constructor(username, opponents, hand){
		this.username = username; // "Me"
		this.opponents = opponents; // ["Opponent1", "Opponent2", "Opponent3"]
		this.hand = hand; //["Mustard","Plum","Rope","Study", "Wrench"]
		this.locations = this.opponents.slice();
		this.locations.unshift(this.username);
		this.players = this.locations.slice();
		this.locations.push("ACTUAL");
		this.solver = new Logic.Solver();

		console.log(this.opponents);
		console.log(this.locations);
		
		//SET UP GAME RULE RESTRICTIONS FOR LOGIC SOLVER

		//Each card can be in exactly one place
		for (var i=0, len = all.length; i < len; i++){
			var variables = [];
			for (var j=0, len2 = this.locations.length; j < len2; j++){
				variables.push(all[i].concat("_",this.locations[j]));
			}
			this.solver.require(Logic.exactlyOne(variables));
			variables =[];
		}

		//exactly 1 of each type must be in the ACTUAL
		var suspects = [];
		for(var i =0, len = person.length; i < len; i++){
			suspects.push(person[i].concat("_","ACTUAL"));
		}
		this.solver.require(Logic.exactlyOne(suspects));
		var murder_weapons =[];
		for(var i =0, len = thing.length; i < len; i++){
			murder_weapons.push(thing[i].concat("_","ACTUAL"));
		}
		this.solver.require(Logic.exactlyOne(murder_weapons));
		var murder_place =[];
		for(var i =0, len = place.length; i < len; i++){
			murder_place.push(place[i].concat("_","ACTUAL"));
		}
		this.solver.require(Logic.exactlyOne(murder_place));

		//Cards in User hand have known position
		var not_in_hand = all.slice();
		for(var i =0, len = this.hand.length; i < len; i++){
			var card_position = this.hand[i].concat("_",this.username);
			this.solver.require(card_position);
			not_in_hand.splice(not_in_hand.indexOf(hand[i]), 1);
		}

		//Other Cards can't be in User hand
		for(var i =0, len = not_in_hand.length; i < len; i++){
			var card_position = "-".concat(not_in_hand[i], "_", this.username);
			this.solver.require(card_position);
		}
	}

	suggestion(person, place, thing, suggestor, disprover=null, proof=null){
		//edge - how to handle when we dont see proof?, also if disproved, we know disprover has one or more of those cards
		if((disprover === null) && (proof !== null)){
			console.log("How did you see the proof if there was no diprover?");
			return null;
		}
		//Possible Call Cases - if disprover is null, proof must be null
			//Someone else makes a suggestion that goes undisproved - disprover == null & proof == null
			//Someone else makes a suggestion that is disproved - disprover == somePlayer & proof == null
			//User makes a suggestion that goes undisproven - disprover == null & proof == null
			//User makes a suggestion that is disproven - disprover == somePlayer & proof == someCard
		var curr_index = this.players.indexOf(suggestor);
		if (disprover === null){
			disprover = suggestor; //this is the case where no one can disprove
		}
		var end_index = this.players.indexOf(disprover);
		//Everyone who didn't disprove doesn't have any of the suggestion cards
		while(this.get_next_location_position(curr_index) != end_index){
			curr_index = this.get_next_location_position(curr_index);
			var curr_person = this.players[curr_index];
			this.solver.require(Logic.and("-".concat(person, "_", curr_person), "-".concat(place, "_", curr_person) , "-".concat(thing, "_", curr_person)));
		}

		if((disprover !== null) && (proof != null)){
			var new_card = disprover.concat("_",proof);
			this.solver.require(new_card);
		}

		//Lastly - return the current state of the solver
		var firstSolution = this.solver.solve();
		if (firstSolution === null){
			return  {
						message:"ERROR: NO SOLUTIONS FOUND",
						solution : null
					};
		}
		console.log(firstSolution.getTrueVars());
		var secondSolution = this.solver.solveAssuming(Logic.not(firstSolution.getFormula()));
		if (secondSolution === null){
			return  {
						message : "Game Solved", 
						solution : firstSolution.getTrueVars() //This is the GAME solution
					};
		}

		return  {
					message:"Multiple Solutions Still Possible",
					solution : null
				};		
	}

	get_next_location_position(curr_position){
		if((curr_position+1) === this.players.length){
			return 0
		}
		else{
			return (curr_position + 1)
		}
	}
}

let cluesol;


//var cluesol = new ClueSolver("Me",["Opponent1", "Opponent2", "Opponent3"], ["Mustard", "Hall", "Revolver", "Kitchen"]);
//console.log(cluesol.suggestion("Mustard", "Hall","Knife", "Opponent1","Opponent2"));
app.get('/:person/:place/:thing/:suggestor/:disprover?/:proof?', function (req, res) {
	let result;
	if (req.params.disprover && !req.params.proof) {
		result = cluesol.suggestion(req.params.person, req.params.place, req.params.thing, req.params.suggestor, req.params.disprover);
	}
	else if (req.params.disprover && req.params.proof) {
		result = cluesol.suggestion(req.params.person, req.params.place, req.params.thing, req.params.suggestor, req.params.disprover, req.params.proof);
	}
	else {
		result = cluesol.suggestion(req.params.person, req.params.place, req.params.thing, req.params.suggestor)
	}
	console.log(result);
	res.send(result);
})


app.post('/', function(req, res) {
	let username = req.body.name;
	let others = req.body.others;
	let cards = req.body.cards;
	cluesol = new ClueSolver(username, others, cards);

	res.send(req.body);
})


// var almostall = ["Mustard","Scarlet","Green","White","Peacock","Billiard Room", "Study", "Lounge", "Dining Room", "Ball Room", "Conservatory", "Library", "Kitchen","Rope", "Knife", "Wrench", "Candlestick", "Revolver"];
// var solution = ["Hall","Plum","Lead Pipe"];

// console.log(cluesol.suggestion("Mustard","Billiard Room","Rope", "1","Me"));

app.listen(port, () => console.log(`app listening on port ${port}`))





