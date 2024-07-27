//Mass rollback with extreme prejudice function
//Written by Bellezzasolo based on User:Writ Keeper/Scripts/massRollback.js
//Written by John254 and modified/rewritten by Writ Keeper with modifications by TheDJ; original is at https://en.wikipedia.org/wiki/User:John254/mass_rollback.js
//Adapted from User:Mr.Z-man/rollbackSummary.js
//Instructions: Selecting the "mega nuke" tab when viewing a user's contributions history
//will open all rollback links displayed there. 
//And then will continue to rollback any new edits by the user while the browser tab is open. (Use with extreme caution)

var Meganuke = {};

const RESCAN_PERIOD = 25; //Milliseconds

Meganuke.meganuke = function()
{
	return new Promise(function(resolve, reject){
		mw.loader.using(['mediawiki.api', 'mediawiki.util', 'mediawiki.api.rollback']).then(function()
		{
			var api = new mw.Api({ajax: {
		        headers: { 'Api-User-Agent': 'Meganuke/Bellezzasolo/2.0.0' }
		    }});
			Meganuke.api = api;
			Meganuke.rolledrevs = [];
			resolve();
		});
	});
};
Meganuke.promise = Meganuke.meganuke();
  
Meganuke.rollbackPast = function (editSummary, revdel) 
{
	if(editSummary === null)
	{
		return false;
	}
	var userName = mw.config.get("wgRelevantUserName");
	var titleRegex = /title=([^&]+)/;
	
	mw.loader.using( 'mediawiki.api.rollback' ).done( function()
	{
		$("a[href*='action=rollback']").each(function(ind, el)
		{
			var params = {};
			if( editSummary !== '' )
			{
				params.summary = editSummary;
			}
			Meganuke.api.rollback( decodeURIComponent(titleRegex.exec(el.href)[1]), userName, params).done( function()
			{
				$(el).after("reverted");
				$(el).remove();
			} );
		} );
	} );
	if(revdel)
	{
		Meganuke.revdelpast();
	}
	return false;
};
Meganuke.check = function(summary, revdel, starttime){
	var lastcheckedtime = $("ul.mw-contributions-list > li > a").first().text();
	var date = new Date();
	date.setSeconds(date.getSeconds() - 1);
	var nextstarttime = date.toISOString();
	Meganuke.api.get({action: "query", list: "usercontribs", uclimit: "100", ucuser: mw.config.get("wgRelevantUserName"), ucdir: "newer", ucstart: starttime, ucprop:"title|ids"}).then(function(apiobj)
	{
		if(apiobj.query.usercontribs.length > 0)
		{
			for (var i = 0; i < apiobj.query.usercontribs.length; i++) {
				var contrib = apiobj.query.usercontribs[i];
				if(Meganuke.rolledrevs.includes(contrib.revid))
				{
					continue;
				}
				var params = {};
				if( summary !== '' )
				{
					params.summary = summary;
				}
				Meganuke.api.rollback(contrib.title, mw.config.get("wgRelevantUserName"), params).then(function()
				{
					mw.notify("Reverted edit on " + contrib.title);
					Meganuke.rolledrevs.push(contrib.revid);
					if(revdel)
					{
						Meganuke.revdel(contrib.revid);
					}
				},
				function(e)
				{
					console.log("Failed to revert on " + contrib.title);
					console.log(e);
					Meganuke.rolledrevs.push(contrib.revid);	//OK, it wasn't rolled, but that won't change
				});
			}
			setTimeout(function(){Meganuke.check(summary, revdel, nextstarttime)}, RESCAN_PERIOD); // check again in a second
		}
		else {
	        setTimeout(function(){Meganuke.check(summary, revdel, nextstarttime)}, RESCAN_PERIOD); // check again in a second
	    }
	});
};
Meganuke.adminnuke = function (logcomment) {
	var query = {
		action: 'query',
		list: 'logevents',
		letype: 'create',
		leprop: 'ids',
		lelimit: 500,
		leuser: mw.config.get('wgRelevantUserName')
	};
	Meganuke.api.get(query).then(Meganuke.adminnuke.callback);
};
Meganuke.adminnuke.callback = function (apiobj) {
	for (var entry in apiobj.query.logevents)
	{
		var creation = apiobj.query.logevents[entry];
		var deletionQuery = {
			action: "delete",
			pageid: creation.pageid,
			reason: Twinkle.meganuke.editsummary
		};
		Meganuke.api.postWithEditToken(deletionQuery);
	}
};
Meganuke.revdel = function (revision) {
	var deletionQuery = {
		action: "revisiondelete",
		type: "revision",
		ids: revision,
		hide: "content|comment|user",
		reason: Twinkle.meganuke.editsummary
	};
	Meganuke.api.postWithEditToken(deletionQuery);
};
Meganuke.revdelpast = function () {
	var uccontinue = null;
	var query = {action: "query", list: "usercontribs", uclimit: "100", ucuser: mw.config.get("wgRelevantUserName"), ucprop:"title|ids"};
	var handlerfunc = function(apiobj)
	{
		for (var i = 0; i < apiobj.query.usercontribs.length; i++) {
			var contrib = apiobj.query.usercontribs[i];
			Meganuke.revdel(contrib.revid);
		}
		if(!('batchcomplete' in apiobj))
		{
			var contquery = $.extend(query, { uccontinue: apiobj.continue.uccontinue});
			Meganuke.api.get(contquery).then(handlerfunc);
		}
	};
	Meganuke.api.get(query).then(handlerfunc);
};
//Twinkle dependent code
mw.loader.using(['ext.gadget.Twinkle', 'mediawiki.api']).then(function(){
Meganuke.promise.then(function(){
(function($){
	
Twinkle.meganuke = function() {
	if ( !mw.config.get('wgRelevantUserName') ) {
		return;
	}

	Twinkle.addPortletLink( Twinkle.meganuke.callback, "MegaNuke", "cont-meganuke", "Contributions automatic reverter" );
};

Twinkle.meganuke.callback = function( ) {
	if( mw.config.get('wgRelevantUserName') === mw.config.get("wgUserName") && !confirm("Is it really so bad that you're nuking yourself?") ){
		return;
	}

	var Window = new Morebits.simpleWindow( 600, 350 );
	//Ugly hack to disable scrollbar
	$(Window.content).css('overflow-x', 'hidden'); 
	Window.setTitle("Contributions MegaNuke");
	Window.setScriptName("Twinkle+");
	Window.addFooterLink( "MegaNuke help", "User:Bellezzasolo/Scripts/meganuke" );
	Window.addFooterLink( "Rollback policy", "WP:Rollback" );
	Window.addFooterLink( '\u2230Bellezzasolo\u2721', "User talk:Bellezzasolo" );
	var form = new Morebits.quickForm( Twinkle.meganuke.callback.evaluate );
	
	//Now display the options
	var actionfield = form.append({ type: "field", label:"Nuke Options"});
	var nukeoptions = [{checked: true, label: 'Revert past contributions', name: 'pastrevert', value: '1'},
					{checked: true, label: 'Revert future contributions', name: 'futurerevert', value: '1'}];
	//If the user is an administrator, show blocking options. Also, if the user is me, because I have to test this!
	if ( Morebits.userIsInGroup('sysop') || mw.config.get("wgUserName") == "Bellezzasolo")
	{
		actionfield.append({ type: "button", label: "Block",
		event: Twinkle.block.callback
		});
		nukeoptions.push({checked: false, label: 'Delete created pages (NUKE)', name: 'adminnuke', value: '1'});
		nukeoptions.push({checked: false, label: 'RevisionDelete user\'s edits', name: 'revdelconts', value: '1'});
	}
	
	actionfield.append({type: 'checkbox',
				name: 'nukeoptions',
				list: nukeoptions
	});
	
	actionfield.append({
			type: 'input',
			name: 'editsummary',
			label: 'Edit Summary',
			tooltip: 'Optional edit summary for reversions',
			value: Twinkle.meganuke.editsummary
	});

	form.append({ type: "submit", label:"Nuke User" });

	var result = form.render();
	Window.setContent( result );
	Window.display();
	result.root = result;
};

Twinkle.meganuke.callback.evaluate = function( e ) {
	var nukePast = e.target.getChecked("pastrevert")[0];
	var nukeFuture = e.target.getChecked("futurerevert")[0];
	var adminNuke = e.target.getChecked("adminnuke")[0];
	var revdel = e.target.getChecked("revdelconts")[0];
	Twinkle.meganuke.editsummary = e.target.editsummary.value;
	if (nukePast == 1)
	{
		Meganuke.rollbackPast(Twinkle.meganuke.editsummary, revdel);
	}
	if(nukeFuture == 1)
	{
		document.title = "Reverting " + document.title;
		var date = new Date();
		date.setMinutes(date.getMinutes() - 1);
		var starttime = date.toISOString();
		Meganuke.check(Twinkle.meganuke.editsummary, revdel, starttime);
	}
	if(adminNuke == 1)
	{
		Meganuke.adminnuke(Twinkle.meganuke.editsummary);
	}
};

if (Morebits.userIsInGroup('rollbacker') || Morebits.userIsInGroup('sysop'))
{
	Twinkle.meganuke();
}
else
{
	mw.notify("You must have rollback privileges to use MegaNuke");
}
})(jQuery);
})});
