// version 0.2.9
// https://raw.github.com/jdlrobson/gadabout/master/src/travelblog.js

var cache = {};
var space = document.location.host.split(".")[0];
var locale = {
	placeholdertext: "Tell us all about this place!",
	placeholdertitle: "name of place",
	nointernet: "No internet connection!",
	sharelinkprefix: "Saved successfully. Share it: ",
	confirmdelete: "Delete this note forever? Yes forever is a scary word!",
	createlinktext: "Write new travel note with this name.",
	reload: "Please try reloading this page."
}
var map, markers, zoom, connection_status = true;

var activeTiddler = {}, position = {};

function getBag() {
	return window.location.host.split(".")[0] + "_public";
}

function getResource(tiddler) {
	return "/recipes/" + getBag() + "/tiddlers/" + encodeURIComponent(tiddler.title);
}

function storeEdit() {
	var tiddler = getTiddler();
	if(!tiddler || !tiddler.title) return;

	$("#publish").attr("disabled", true);
	var url = getResource(tiddler);
	if(tiddler) {
		$.ajax({ type: "PUT",
			contentType: "application/json",
			url: url,
			data: JSON.stringify(tiddler),
			success: function(r) {
				window.location.pathname = url;
				clearCache();
			},
			error: function() {
				$("#publish").attr("disabled", false);
				$("<div class='error' />").text(locale.nointernet).appendTo("#window-edit");
			}
		});
	}
}

function loadTiddler(callback) {
	var blankTiddler = { title: null, text: null, fields: {} };
	var tid = localStorage.getItem("currentTiddler");
	var hash = window.location.hash;
	var url = hash.substr(2);
	if(url) {
		$.ajax({ url: url, dataType: "json",
			success: function(tiddler) {
				activeTiddler = tiddler;
				callback(tiddler);
			},
			error: function() {
				var title = url.split("/");
				title = title[title.length - 1];
				activeTiddler = blankTiddler;
				if(title) {
					activeTiddler.title = decodeURIComponent(title);
				}
				callback();
			}
		})
	} else {
		activeTiddler = tid ? JSON.parse(tid) : blankTiddler;
		callback();
	}
}
function getTiddler() {
	var tiddler = activeTiddler;
	if(typeof(position.latitude) != "undefined") {
		tiddler.fields['geo.lat'] = position.latitude;
	}
	if(typeof(position.longitude) != "undefined") {
		tiddler.fields['geo.long'] = position.longitude;
	}
	return tiddler;
}

function cacheEdit() {
	var tiddler = getTiddler();
	var json = JSON.stringify(tiddler);
	localStorage.setItem("currentTiddler", json);
}
function clearCache() {
	localStorage.removeItem("currentTiddler");
}

function showPublishButton(area) {
	if($("#publish").length === 0) {
		$("<button />").attr("id", "publish").click(function(ev) {
				storeEdit();
			}).text("Publish to web.").appendTo(area);
	}
}

function makeTextInput(area) {
	var tiddler = getTiddler();
	var allowSave = function(ev) {
		activeTiddler.text = $(ev.target).val();
		if(connection_status) {
			showPublishButton(area);
		}
		cacheEdit();
	};

	$("<textarea id='edit-text' />").attr("placeholder", locale.placeholdertext).change(allowSave).
		blur(allowSave).appendTo(area);
	if(tiddler) {
		$("#edit-text").text(tiddler.text)
	}
}

function showCurrentPosition() {
	if(typeof(position.latitude) != "undefined" && typeof(position.longitude) != "undefined") {
		var center = drawMarker(position.longitude, position.latitude, null);
		map.setCenter(center, zoom);
	}
}

function makeTitleInput(area) {
	var tiddler = getTiddler();
	var heading = $("<h2>Place: </h2>").appendTo(area);
	$("<input id='edit-title' />").blur(function(ev) {
			var val = $(ev.target).val();
			setTitle(val);
		}).attr("placeholder", locale.placeholdertitle).appendTo(heading);
	function setTitle(val) {
		if(val) {
			cacheEdit();
			$("#edit-title").parent().empty().text(val);
			activeTiddler.title = val;
			var tiddler = getTiddler();
			if(!position.latitude) {
				$("#edit-location .locationInput").val(val);
				$("#edit-location .find").click();
			}
		}
		$("#edit-text").show();
	}

	var geohandler = function(r) {
		position.latitude = r.lngLat.lat;
		position.longitude = r.lngLat.lng;
		showCurrentPosition();
		cacheEdit();
	};

	// make it find the location lat and lng
	$("<div id='edit-location' />").geoSearch({
			service: "nominatim", handler: geohandler
		}).appendTo(area);
	$("#edit-location input").hide();

	$("<button class='geobutton' />").text("Associate this note with a location").click(function(ev) {
			$("#edit-location-2").toggle();
		}).appendTo(area);
	$("<div id='edit-location-2' style='display: none;' />").geoSearch({
			service: "nominatim", handler: geohandler
		}).appendTo(area);

	makeTextInput(area);
	$("#edit-text").hide();

	// load an existing title if it exists
	if(tiddler) {
		setTitle(tiddler.title);
	}
}

function addDeleteButton(area) {
	var toolbar = $("<div id='edit-toolbar' />").appendTo(area)[0];
	var success = function(ev) {
		$("#window-edit").empty();
		activeTiddler = null;
		window.location.hash = ""; // reset hash so it doesnt reload
		clearCache();
		makeEditorArea();
	}
	$("<button id='deleteButton' />").text("delete").appendTo(toolbar).click(function(ev) {
		if(confirm(locale.confirmdelete)) {
			$(ev.target).attr("disabled", true);
			$.ajax({ url: getResource(activeTiddler), type: "delete",
				success: function(r) {
					success(ev);
				},
				error: function(ctx) {
					if(ctx.status === 404) {
						success(ev);
					} else {
						$(ev.target).attr("disabled", false);
					}
				}
			});
		}
	});
	$("<button id='cancelButton'/>").text("cancel").click(function(ev) {
		if(confirm("Lose these unsaved changes?")) {
			success(ev);
		}
	}).appendTo(toolbar);
}

function makeEditorArea() {
	loadTiddler(function(tiddler) {
		constructMenu(false);
		if(tiddler) {
			var lat = tiddler.fields["geo.lat"], lng = tiddler.fields["geo.long"];
			if(typeof(lng) != "undefined") {
				position.longitude = lng;
			}
			if(typeof(lat) != "undefined") {
				position.latitude = lat;
			}
		}
		var area = $("#window-edit")[0];
		addDeleteButton(area);
		makeTitleInput(area);
		map = createMap(area);
		markers = new OpenLayers.Layer.Markers( "Markers" );
		showCurrentPosition();
	});
}

function makeTiddlyLink(el) {
	$(el).click(clickTiddlyLink);
}

function isTiddlyLink(el) {
	var href = $(el).attr("href") || "";
	var hasClass = $(el).hasClass("externalLink");
	var hostLocation = window.location.protocol + "//" + window.location.host;
	// check for externalLink class
	if(hasClass && href.indexOf("#") === -1 &&
		(href[0] === "/" || href.indexOf("/") === -1)) {
		hasClass = false;
	} else if(hasClass && href.indexOf("#") === -1 && href.indexOf(hostLocation) === 0) {
		href = href.substr(hostLocation.length, href.length);
		hasClass = false;
	}
	var notTiddlyLink = $(el).hasClass("notTiddlyLink");
	return !notTiddlyLink && !hasClass ? true : false;
}

function clickTiddlyLink(ev)  {
	var href = $(ev.target).attr("href");
	if(isTiddlyLink(ev.target)) {
		printUrl(href);
		ev.preventDefault();
		return false;
	}
}

$("#window a").live("click", clickTiddlyLink);

function createMap(maparea) {
	if($("#mapdiv").length === 0) {
		$("<div id='mapdiv' />").appendTo(maparea);
	}
	OpenLayers.ImgPath = "/";
	map = new OpenLayers.Map("mapdiv", { theme: null });
	map.addLayer(new OpenLayers.Layer.OSM()); 
	zoom = 8;
	return map;
}

function drawMarker(lng, lat, title) {
	var lonLat = new OpenLayers.LonLat(lng, lat).transform(
			new OpenLayers.Projection("EPSG:4326"), // transform from WGS 1984
			map.getProjectionObject() // to Spherical Mercator Projection
		);
	var size = new OpenLayers.Size(8, 8);
	var offset = new OpenLayers.Pixel(-(size.w/2), -size.h);
	var icon = new OpenLayers.Icon("/marker.png", size, offset);
	var marker = new OpenLayers.Marker(lonLat, icon);
	if(title) {
		marker.events.register('dblclick', marker, function(ev) { 
			printUrl("/" + title);
			OpenLayers.Event.stop(ev);
		});
		var popup;
		marker.events.register('mouseover', marker, function(ev) {
			popup = new OpenLayers.Popup(null,
				lonLat,
				new OpenLayers.Size(200,70),
				"<p>" + title + "</p><p>(double click to open)</p>",
				true);
			map.addPopup(popup);
		});
		marker.events.register('mouseout', marker, function(ev) {
			popup.destroy();
		});
	}
	markers.addMarker(marker);
	return lonLat;
};

function printMap(url) {
	var lng = parseFloat($(".meta .geo .longitude").text(), 10);
	var lat = parseFloat($(".meta .geo .latitude").text(), 10);
	var maparea = $("<div />").addClass("mapArea").prependTo("#article")[0];
	$('<div class="end" />').appendTo("#article");
	map = createMap(maparea);
	markers = new OpenLayers.Layer.Markers( "Markers" );
	map.addLayer(markers);

	var tiddlersToMarkers = function(tiddlers) {
		var lat1, lat2, lon1, lon2;
		for(var i = 0; i < tiddlers.length; i++) {
			var tiddler = tiddlers[i];
			var fields = tiddler.fields;
			var lat = parseFloat(fields['geo.lat'], 10);
			var lng = parseFloat(fields['geo.long'], 10);
			if(lat && lng) {
				lat1 = typeof(lat1) == "undefined" || lat < lat1 ? lat : lat1;
				lat2 = typeof(lat2) == "undefined" || lat > lat2 ? lat : lat2;
				lon1 = typeof(lon1) == "undefined" || lng < lon1 ? lng : lon1;
				lon2 = typeof(lon2) == "undefined" || lng > lon2 ? lng : lon2;
				drawMarker(lng, lat, tiddler.title);
			}
		}
		return [lon1 || -180, lat1 || -90, lon2 || 180, lat2 || 90];
	};

	var center;
	if(lng && lat) {
		center = drawMarker(lng, lat, null);
		map.setCenter(center, zoom);
		var searchurl = "/search?q=near:"+ parseInt(lat,10) +
			","+parseInt(lng,10) +",1000000";
		loadUrl(searchurl, function(tiddlers) {
				tiddlersToMarkers(tiddlers);
			}, { dataType: "json" });
	}
	// add markers to map from the links in this tiddler
	var titles = [];
	$("#window .activeTiddlyLink").each(function(i, el) {
		titles.push("title:"+encodeURI($(el).text()))
	});
	if(titles.length > 0) {
		loadUrl(window.location.hash.substr(2),
			function(tiddlers) {
				var bb = tiddlersToMarkers(tiddlers);
				if(!center) {
					var lo = ((bb[2] - bb[0]) / 2) + bb[0];
					var la = ((bb[3] - bb[1]) / 2) + bb[1];
					center = new OpenLayers.LonLat(lo, la).transform(
						new OpenLayers.Projection("EPSG:4326"), // transform from WGS 1984
						map.getProjectionObject() // to Spherical Mercator Projection
					);
					map.setCenter(center, 1);
				}
			}, { dataType: "json" });
	}
}
function cleanupHTMLSerialization() {
	var links = $("#window a");
	var loaded = 0;
	links.each(function(i, el) {
		if(isTiddlyLink(el)) {
			var url = $(el).attr("href");
			$(el).addClass("activeTiddlyLink");
			if(loaded < 10) { // pre load first 10 links for SPEED
				loadUrl(url);
				loaded += 1;
			}
		}
		// remove bad links
		var text = $(el).text();
		if(["SiteTitle", "viewer", "editor", "ServerSettings",
			"SiteIcon", space + "SetupFlag" ].indexOf(text) > -1) {
			$(el).parent("li").remove();
		}
	});
	var tiddlersView = $("#tiddlers").length > 0;
	if(tiddlersView) {
		$("#header").html("<h1>All Travel Notes</h1>");
		constructMenu(true);
	} else {
		constructMenu(false);
	}
	var backlinks = $("<div id='backLinks' />").insertAfter($("#header")[0])[0];
	var title = $("#title").text();
	var bag = $("#links .bag").text();
	if(title && bag) {
		$.ajax({ dataType: "json",
			url: "/bags/" + bag + "/tiddlers/" + title + "/backlinks", // bags must be used for backlinks
			success: function(tiddlers) {
				if(tiddlers.length > 0) {
					var txt = tiddlers.length > 1 ? "tiddlers" : "tiddler";
					$("<span />").text(tiddlers.length + " " + txt + " link here: ").appendTo(backlinks);
				}
				var list = $("<ul />").appendTo(backlinks)[0]
				for(var i = 0; i < tiddlers.length; i++) {
					var tiddler = tiddlers[i];
					var item = $("<li/>").appendTo(list)[0];
					$("<a />").attr("href", "/recipes/" + tiddler.bag + "/tiddlers/" + tiddler.title).
						text(tiddler.title).appendTo(item);
				}
			}
		});
	}
	var headerLink = $("#header h1 a");
	if(headerLink) {
		$(headerLink).removeClass("activeTiddlyLink").addClass("notTiddlyLink");
		$(headerLink).attr("href", "/" + $(headerLink).text());
	}
	$("#links").remove();
}

function constructMenu(newbutton) {
	$("#bar").remove();
	var menu = $("<div id='bar' />").appendTo("#window")[0];
	$("<a href='/editor' />").addClass("externalLink newButton notTiddlyLink").text("add note").appendTo(menu);
	var path = window.location.pathname === "/" ?
		"/" + encodeURIComponent($("#header h1 a").text()) : window.location.pathname;
	if($("#tiddlertext").length > 0) {
		$("<a href=\"/editor#" + path + "\" />").
			addClass("externalLink editButton notTiddlyLink").
			text("edit note").appendTo(menu);
	}
	$('<a href="/customise">customise</a>').
		addClass("externalLink configureButton notTiddlyLink").appendTo(menu);
}

function loadUrl(url, callback, options) {
	var match = url ? url.match(/\/tiddlers\.form/) : false;
	if(match && match[0]){
		cache[url] = "Unsupported page";
		if(callback) {
			callback(r,  textStatus, jqXHR);
		}
		return;
	}
	options = options || {};
	$("#createLink").remove();
	$.ajax({
		url: url,
		dataType: options.dataType || "html",
		success: function(r,  textStatus, jqXHR) {
			cache[url] = r;
			if(callback) {
				callback(r, textStatus, jqXHR);
			}
		},
		error: function(jqXHR) {
			return callback ? callback(false, "", jqXHR) : false;
		}
	});
}
function transformDefaultHtml(url) {
	cleanupHTMLSerialization();
	printMap(url);
	$(".meta").remove();
}

function supports_history_api() {
	return !!(window.history && history.pushState);
}

function printUrl(url) {
	if(!supports_history_api()){
		window.location.href = url;
		return;
	}
	//console.log(url);
	$("#window").empty().text("loading...");
	history.pushState({ url: url }, null, url);
	function success(url) {
		var r = cache[url]
		var doc = $(r);
		$("#window").empty();
		var container;
		//console.log("doc", doc);
		$(doc).each(function(i, el) {
			var id = $(el).attr("id") || false;
			if(id == "container") {
				container = el;
			}
		});
		//console.log("!",container);
		if(container) {
			var win = $("#window")[0];
			$("#header", container).appendTo(win);
			$("#article", container).appendTo(win);
		}
		transformDefaultHtml(url);
		document.title = $("#header h1", r).text();
	}
	if(cache[url]) {
		success(url);
	} else {
		loadUrl(url, function(tiddlers,  textStatus, jqXHR) {
			if(!tiddlers) {
				document.title = "Missing note";
				$("#createLink").remove();
				$("#window").empty();
				if(jqXHR.status === 404) {
					$("<h2>Missing</h2>").appendTo("#window");
					$("<a id='createLink' />").addClass("externalLink").
						attr("href", "/editor#!" + url).
						text(locale.createlinktext).appendTo("#window");
				} else {
					$("<h2>Whoops!</h2>").appendTo("#window");
					$("<a id='createLink' />").addClass("externalLink").
						attr("href", window.location.href).
						text(locale.reload).appendTo("#window");
				}
			} else {
				success(url);
			}
		});
	}
}

function setup(editmode) {
	if(!editmode) {
		if($("#win").length === 0) {
			var body = $("#article").html();
			$(document.body).html(["<div id='tbbody'>",
				"<!--HEADER-->",
				"<div id='siteheading'>",
					"<div id='SiteIcon'></div>",
					"<h1><a href='/' id='siteTitle'></a></h1>",
				"</div>",
				"<div id='SiteInfo'></div>",
				"<!--HEADER-->",
				"<hr/>",
				"<a id='listLink' href='/tiddlers?select=tag:!excludeLists",
				"&select=bag:!takenote_public&sort=title'>list travel notes</a>",
				"<hr/>",
				"<div id='window'></div>",
				"<div id='disqus_thread'></div>",
				"<div id='footer'></div>",
			"</div>"].join(""));
			$("#window").html(body);
		}
		var footerEl = $("<div />").addClass("footerbar").appendTo("#footer")[0];
		$('<a href="/getyourown">get your own here!</a>').addClass("footerLink notTiddlyLink").
			appendTo(footerEl);
		$('<a href="/challenge/tiddlywebplugins.tiddlyspace.cookie_form?tiddlyweb_redirect=%2Ftiddlers">login</a>').
			addClass("footerLink notTiddlyLink").appendTo(footerEl);
		$('<a href="https://github.com/jdlrobson/gadabout">developers</a>').
			addClass("footerLink notTiddlyLink").appendTo(footerEl);
		transformDefaultHtml(window.location.path);
	}
	$.ajax({ url: "/SiteTitle", dataType: "json",
		success: function(tiddler) {
			$("#siteTitle").text(tiddler.text);
		}
	});
	$.ajax({ url: "/SiteInfo", dataType: "json",
		success: function(tiddler) {
			$("#SiteInfo").text(tiddler.text);
		}
	});
}
var initialised;
var startUrl = window.location.pathname;
$(document).ready(function() {
	var _onpopstate = window.onpopstate;
	window.onpopstate = function(ev) {
		if(_onpopstate) {
			_onpopstate.apply(this, arguments);
		}
		if(!initialised) {
			initialised = true;
			return false;
		}
		var url;
		if(ev.state && ev.state.url) {
			url = ev.state.url;
		} else if(cache[window.location.pathname]) {
			url = window.location.pathname;
		} else if(window.location.pathname == startUrl) {
			url = startUrl;
		}
		if(url) {
			printUrl(url);
		}
		ev.preventDefault();
	}
	var editmode = $("#window-edit").length > 0;
	setup(editmode);
	
	if(editmode) {
		makeEditorArea();
	} else {
		makeTiddlyLink($("#listLink")[0]);
	}
});
