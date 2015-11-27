// STEP 1 (lecture 1.3): Create a global constructor for our app's application code that takes a Firebase application name as its first parameter
function LiveLinks(fbname) {
    // STEP 2 (lecture 1.3): Create a Firebase reference by invoking Firebase with the application name parameter and assign it to the local scope using the key "firebase"
    var firebase = new Firebase('https://' + fbname + '.firebaseio.com/');
    this.firebase = firebase;
    // STEP 2 (lecture 1.3): Create a reference to the target node
    var linksRef = firebase.child('links');
    var usersRef = firebase.child('users');
    var instance = this;
    // STEP 3 (lecture 2.3): Add logic for form submission using the URL value as the unique key; which needs to be Base-64 encoded since Firebase doesn't allow special characters including periods in Firebase keys
    // Create many-to-many relationship through the submit link callback to keep data flat
    this.submitLink = function(url, title){
        url = url.substring(0,4) !== "http" ? "http://" + url : url;
        linksRef.child(btoa(url)).update({
            title: title
        }, function(error){
            if(error){
                instance.onError(error);
            } else {
                linksRef.child(btoa(url))
                        .child('users')
                        .child(instance.auth.uid)
                        .set(true);
                usersRef.child(instance.auth.uid)
                        .child('links')
                        .child(btoa(url))
                        .set(true);
            }
        });
    };

    this.login = function(email, password) {
        firebase.authWithPassword({
            email: email,
            password: password
        }, function(error) {
            if (error) { instance.onError(error) }
        });
    };

    this.signup = function(alias, email, password) {
        firebase.createUser({
            email: email, 
            password: password
        }, function(error, authResponse) {
            if (error) {
                instance.onError(error);
            } else {
                instance.auth = authResponse;
                usersRef.child(instance.auth.uid).set({alias: alias}, function(error) {
                    if (error) {
                        instance.onError(error);
                    } else {
                        instance.login(email, password);
                    }
                });
            }
        });
    };

    this.logout = function() {
        firebase.unauth();
    };

    function getSubmitters(linkId, userIds){
        if(userIds){
            $.each(userIds, function(userId){
                var linkUserRef = linksRef.child(linkId).child('users').child(userId);
                linkUserRef.once('value', function(snapshot){
                    usersRef.child(snapshot.key())
                            .child('alias')
                            .once('value', function(snapshot){
                                instance.onLinkUserAdded(linkId, snapshot.val());
                            })
                })
            });
        }
    };


    // STEP 3 (lecture 2.3): Add a listener to the database for changes
    // overrideable event functions
    this.onLogin = function(user) {};
    this.onLogout = function() {};
    this.onLinksChanged = function(links) {};   // Why did he add this??? ... needed to set onLinksChanged as a function so this.onLinksChanged() below doesn't fail when running other code from console.  Weird.
    this.onLinkUserAdded = function(linkId, alias) {};    
    this.onError = function(error) {};

    // setup long-running firebase listeners
    this.start = function(){

        firebase.onAuth(function(authResponse){
            if(authResponse){
                usersRef.child(authResponse.uid).once('value', function(snapshot){
                    instance.user = snapshot.val();
                    instance.onLogin(instance.user);
                });
            } else {
                instance.onLogout();
            }
        });

        linksRef.on('value', function(snapshot){
            var links = snapshot.val();
            var preparedLinks = [];
            for(var url in links){
                if(links.hasOwnProperty(url)){
                    preparedLinks.push({
                        title: links[url].title,
                        url: atob(url),   // Decode URL
                        id: url
                    });
                    getSubmitters(url, links[url].users);
                }
            }
            instance.onLinksChanged(preparedLinks);
        }.bind(this));

    };

};

$(document).ready(function(){
    // STEP 2 (lecture 1.3): Instantiate a new object for the Firebase app on document load
    var ll = new LiveLinks('livelinks20151123');
    ll.onError = function(error) {
        alert(error.message);
    }

    $(".show-submit-link").click(function() {
        $(".link-form").toggle();       
    });


    // STEP 3 (lecture 2.3): Call the object's submitLink method (we created above) when the form is submitted
    $('.link-form form').submit(function(event){
        event.preventDefault();
        ll.submitLink($(this).find('input.link-url').val(), $(this).find('input.link-title').val());
        $(this).find('input[type=text]').val('').blur();
        return false;
    });
    // STEP 3 (lecture 2.3): Show list of links as they are changed
    ll.onLinksChanged = function(links){
        $('.links-list').empty();
        links.map(function(link){
            var linkElement = "<li data-id='" + link.id + "' class='list-group-item'>" +
                                "<a href='" + link.url + "'>" + link.title + "</a><br>" +
                                "<span class='submitters'>Submitted by:</span>"
                              "</li>";
            $('.links-list').append(linkElement);
        });
    };
    ll.onLinkUserAdded = function(linkId, alias){
        var submitters = $("[data-id='" + linkId + "'] span.submitters");
        if(submitters.text().indexOf(alias) == -1){
            submitters.append(" " + alias);
        }
    };
    ll.onLogin = function() {
        $(".auth-links .login, .auth-links .signup, .auth-forms").hide();
        $(".auth-links .logout").show();
    };

    ll.onLogout = function() {
        $(".auth-links .login, .auth-links .signup").show();
        $(".auth-links .logout").hide();
    };

    $(".auth-links .login a").click(function() {
        $(".auth-forms, .auth-forms .login").show();
        $(".auth-forms .signup").hide();
        return false;
    });

    $(".auth-links .signup a").click(function() {
        $(".auth-forms .login").hide();
        $(".auth-forms, .auth-forms .signup").show();
        return false;
    });

    $(".auth-links .logout a").click(function() {
        ll.logout();
        return false;
    });

    $(".auth-forms .login form").submit(function(event) {
        ll.login($(this).find('input.login-email').val(), $(this).find('input.login-password').val());
        return false;
    });

    $(".auth-forms .signup form").submit(function(event) {
        var alias = $(this).find('input.signup-alias').val(),
        email = $(this).find('input.signup-email').val(), 
        password = $(this).find('input.signup-password').val(),
        passwordConfirm = $(this).find('input.signup-password-confirm').val();
        if (password === passwordConfirm) {
            ll.signup(alias, email, password);
        }
        return false;
    });


    ll.start();
});


/* Firebase Methods
    child
    child_added
    child_changed
    child_removed
    push                ... appends to the node
    set()               ... changes everything in that node
    on('value', ... )   ... listens and returns whole list
    update()
    remove()
    .firebase.authWithPassword({email: '', password: ''}, function(error, authObj){}) ... if no error, error is null, else it's a message
    .firebase.unauth()
    onAuth()            ... when auth changes
    .unauth()           ... logout
    getAuth()           ... is the user logged in?  null if not
*/
/*
ll.firebase.createUser({email: 'taylor.westin@gmail.com', password: 'password!'}, function(error, authResponse){
    authObj = authResponse;
});
// Create users node in Firebase
users = ll.firebase.child('users');
// Create new user in node using the UID in the authObj
user = users.child(authObj.uid);
user.set({alias: 'Secret Agent'});  // This is when all above gets created in Firebase

ll.firebase.authWithPassword({
    email: 'taylor.westin@gmail.com',
    password: 'password!'
}, function(error, authResponse){
    if(authResponse){
        users.child(authResponse.uid).on('value', function(snapshot){
            currentUser = snapshot.val();
        })
        console.log('Logged in user :: ', authResponse);
    } else {
        console.log('User logged out!');
    }
});


ll.firebase.onAuth(function(authResponse){
    if(authResponse){
        console.log('Logged in user :: ', authResponse);
    } else {
        console.log('User logged out!');
    }
});



ll.firebase.getAuth();
*/



