"use strict"

var VERT_ALIGNMENT = false;
var LEFT_TO_RIGHT = true;
var ACTIVE = "#2653c9";
var NORMAL = "#7fa2ff";
var FANCY = "#cc22fc";
var POS_COLOR = "#afa2ff";
var ST_COLOR = "#bcd2ff"
var LOW_DIGITS = {0: "₀", 1: "₁", 2: "₂", 3: "₃", 4: "₄", 5: "₅",
6: "₆", 7: "₇", 8: "₈", 9: "₉", "-": "₋", "(" : "₍", ")" : "₎"};

// require lib for CoNLL-U parsing
var conllu = require("conllu");

function conlluDraw(content) {
    /* Draw the tree. */
    var sent = new conllu.Sentence();
    sent.serial = content;
    changeBoxSize(sent);
    var layout = formLayout();

    var cy = window.cy = cytoscape({
        container: document.getElementById("cy"),

        boxSelectionEnabled: false,
        autounselectify: true,
        autoungrabify: true,
        userZoomingEnabled: false,
        layout: layout, 
        style: CY_STYLE,
        elements: conllu2cy(sent)
    });
}


function changeBoxSize(sent) {
    var minWidth = 500;
    var maxWidth = 1700;
    var length = sent.tokens.length;
    if (VERT_ALIGNMENT) {
        $("#cy").css("width", "1700px");       
        $("#cy").css("height", (length * 50) + "px");
    } else {
        var width = length * 150;
        if (width < minWidth) {
            width = minWidth;
        } else if (width > maxWidth) {
            width = maxWidth;
        }
        $("#cy").css("width", width + "px");    
        $("#cy").css("height", "400px");    
    }
}


function formLayout() {
    var layout = {name: "grid", condense: true};
    if (VERT_ALIGNMENT) {
        layout.cols = 2;
        layout.sort = vertAlSort;
    } else {
        layout.rows = 2;
        if (LEFT_TO_RIGHT) {
            layout.sort = simpleIdSorting;
        } else {
            layout.sort = rtlSorting;
        }
    }
    return layout;
}


function conllu2cy(sent) {
    var graph = [];
    $.each(sent.tokens, function(n, token) {
        if (token.tokens){
            var spId = "ns" + strWithZero(n);
            var id = toSubscript(" (" + findSupTokId(token.tokens) + ")");
            graph.push({"data": {"id": spId,"label": token.form + id}});
            $.each(token.tokens, function(n, subTok) {
                graph = createToken(graph, subTok, spId);
            });
        } else {
            graph = createToken(graph, token);
        }
    })

    return graph;
}


function findSupTokId(subtokens) {
    return subtokens[0].id + "-" + subtokens[subtokens.length - 1].id;
}


function toSubscript(str) {
    var substr = "";
    $.each(str, function(n, char) {
        var newChar = (LOW_DIGITS[char]) ? LOW_DIGITS[char] : char;
        substr += newChar;
    })
    return substr;
}


function createToken(graph, token, spId) {
    /* Takes the tree graph, a token object and the id of the supertoken.
    Creates the wf node, the POS node and dependencies. Returns the graph. */

    // handling empty form
    if (spId) {token.form = token.lemma};
    if (token.form == undefined) {token.form = " "};

    var nodeId = strWithZero(token.id);
    var nodeWF = token;

    nodeWF.parent = spId;
    nodeWF.length = nodeWF.form.length + 1 + "em";
    nodeWF.id = "nf" + nodeId;
    nodeWF.label = nodeWF.form + toSubscript("" + +nodeId);
    nodeWF.state = "normal";
    graph.push({"data": nodeWF, "classes": "wf"});

    graph = makePOS(token, nodeId, graph);
    graph = makeDependencies(token, nodeId, graph);
    return graph;
}


function makeDependencies(token, nodeId, graph) {
    /* if there is head, create an edge for dependency */

    if (token.head && token.head != 0) {
        var head = strWithZero(token.head);
        var edgeDep = {
            "id": "ed" + nodeId,
            "source": "nf" + head,
            "target": "nf" + nodeId,
            "label": token.deprel,
            "ctrl": [55, 55, 55, 55]
        }
        var coef = (token.head - nodeId);
        if (!LEFT_TO_RIGHT) {coef *= -1}; // support for RTL
        if (Math.abs(coef) != 1) {coef *= 0.7};
        edgeDep.ctrl = edgeDep.ctrl.map(function(el){ return el*coef; });
        graph.push({"data": edgeDep, "classes": "dependency"});
    };
    return graph;
}


function makePOS(token, nodeId, graph) {
    /* Creates nodes for POS and edges between wf and POS nodes */

    var pos = "";
    if (token.upostag != undefined) {
        pos = token.upostag;
    } else if (token.xpostag != undefined) {
        pos = token.xpostag;
    };

    // creating pos node
    var nodePOS = {
        "id": "np" + nodeId,
        "label": pos,
        "length": (pos.length + 1) + "em"
    }
    graph.push({"data": nodePOS, "classes": "pos"});

    // the edge from token to POS
    var edgePOS = {
        "id": "ep" + nodeId,
        "source": "nf" + nodeId,
        "target": nodePOS.id
    }
    graph.push({"data": edgePOS, "classes": "pos"});

    return graph;
}


function sortNodes(n1, n2) {
    // TODO?
}


function simpleIdSorting(n1, n2) {
    if( n1.id() < n2.id() ){
        return -1;
    } else if( n1.id() > n2.id() ){
        return 1;
    } else {
        return 0;
    }
}


function rtlSorting(n1, n2) {
    if ((n1.hasClass("wf") && n2.hasClass("wf")) // if the nodes have the same class
        || (n1.hasClass("pos") && n2.hasClass("pos"))) {
        return simpleIdSorting(n1, n2) * -1;
    } else if (n1.hasClass("wf") && n2.hasClass("pos")) {
        return -1;
    } else if (n1.hasClass("pos") && n2.hasClass("wf")) {
        return 1;
    } else {
        return 0;
    }
}


function vertAlSort(n1, n2) {
    var num1 = +n1.id().slice(2);
    var num2 = +n2.id().slice(2);
    if (num1 != num2) {
        return num1 - num2;
    } else {
        if (n1.hasClass("wf") && n2.hasClass("pos")) {
            return 1;
        } else if (n1.hasClass("pos") && n2.hasClass("wf")) {
            return -1
        } else {
            return 0;
        }
    }
}


function strWithZero(num) {
    return (String(num).length > 1) ? "" + num : "0" + num;
}


/* TODO:

var nodeWF = Object.create(token);
...
nodePOS = Object.create(token);
...

*/
