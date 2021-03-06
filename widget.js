requirejs.config({
    paths: {
        zipwhipPhoneUtil: 'http://zipwhip.com/resources/js/util/phoneNumberUtil',
        zipwhipPhoneFormat: 'http://zipwhip.com/resources/js/libs/PhoneFormat',
        zipwhipApp: 'http://zipwhip.com/resources/js/App',
        
    },
    shim: {
        zipwhipPhoneFormat: ['zipwhipApp', 'zipwhipPhoneUtil']
    }
});
// Test this element. This code is auto-removed by the chilipeppr.load()
cprequire_test(["inline:com-chilipeppr-elem-zipwhip"], function (zipwhip) {
    console.log("test running of " + zipwhip.id);
    zipwhip.init();
    
    function testOnDone() {
        console.log("setting up test publish /done");
        setTimeout(
            function() {
                chilipeppr.publish("/com-chilipeppr-widget-gcode/done", "Duration 00:00:06 Lines 31")
            },
            3000
        );
    }
    //testOnDone();
    $('#' + zipwhip.id).css('margin', '20px');
    
} /*end_test*/ );

cpdefine("inline:com-chilipeppr-elem-zipwhip", ["chilipeppr_ready", /*"zipwhipPhoneFormat",*/ "jquerycookie"], function () {
    return {
        id: "com-chilipeppr-elem-zipwhip",
        url: "(auto fill by runme.js)",       // The final URL of the working widget as a single HTML file with CSS and Javascript inlined. You can let runme.js auto fill this if you are using Cloud9.
        fiddleurl: "(auto fill by runme.js)", // The edit URL. This can be auto-filled by runme.js in Cloud9 if you'd like, or just define it on your own to help people know where they can edit/fork your widget
        githuburl: "(auto fill by runme.js)", // The backing github repo
        testurl: "(auto fill by runme.js)",   // The standalone working widget so can view it working by itself
        name: "Element / Zipwhip",
        desc: "A widget for ChiliPeppr that lets you send text messages upon events occurring inside ChiliPeppr, i.e. text yourself when a CNC job is done.",
        foreignSubscribe: {
            "/com-chilipeppr-widget-gcode/done" : "When we see this signal, we send the text indicating the job is done running.",
            "/com-chilipeppr-widget-gcode/onpause" : "When we see this signal, we check if it was from an M6 which comes in the 2nd parameter. If it is, we know to trigger a text to you to do a tool change."
        },
        settings: null,    // stores user settings from cookie
        locale: null,
        init: function () {
            //console.log("zipwhip:", Zw);
            this.formSetup();
            this.forkSetup();
            this.subscribeSetup();
            
            var that = this;
            
            // getting too many errors from ipinfo
            /*
            this.getIpInfo(function(resp) {
                if ('country' in resp) {
                    that.locale = resp.country;
                }
            });
            */
            
            console.log(this.name + " done loading.");
        },
        getIpInfo: function(callback) {
            $.get("http://ipinfo.io", function (response) {
                
                console.log("getIpInfo response:", response);
                //$("#ip").html("IP: " + response.ip);
                //$("#address").html("Location: " + response.city + ", " + response.region);
                //$("#details").html(JSON.stringify(response, null, 4));
                if (callback) callback(response);
                
            }, "jsonp");
        },
        rawPhone: function(phone) {
            phone = phone.replace(/\D/g, "");
            return phone;
        },
        formatPhone: function(phone, sessionkey, callback) {
            var cleanphone = phone.replace(/\D/g, "");
            var re = /(\d\d\d)(\d\d\d)(.*)/;
            re.exec(cleanphone);
            var fmt = "(" + RegExp.$1 + ") " + RegExp.$2 + "-" + RegExp.$3;
            if (callback) callback(fmt);
        },
        formatPhoneViaCall: function(phone, callback) {
            // https://api.zipwhip.com/mobileNumber/format?countryCode=US&mobileNumbers=2068597896&session=c49883a8-96df-4533-94bd-4a23c4b8680a:277358302
            //var url = "http://chilipeppr.com/zipwhip?url=http://api.zipwhip.com/mobileNumber/format?countryCode=US&mobileNumbers=" + phone + "&session=-fill-from-server-session-";
            var url = "//chilipeppr.com/zipwhip?url=http://api-lite.zipwhip.com/numberinfo/" + this.rawPhone(phone);
            
            // see if should add country to help hint for format
            if (this.locale) url += "?region=" + this.locale;
            
            console.log("about to call url:", url);
            $.ajax({
                url: url,
                context: this,
            }).done(function(response) {
                console.log("got back info from format phone. response:", response);
                // we will get back json of success or error
                var obj = $.parseJSON(response);
                console.log("obj val:", obj);
                
                var fmt;
                
                if ('error' in obj) {
                    // there was error
                    fmt = phone;
                } else {
                    fmt = obj.format.international;
                    if ('national' in obj.format) fmt = obj.format.national;
                }
                
                if (callback) callback(fmt);
            });
        },
        subscribeSetup: function() {
            chilipeppr.subscribe("/com-chilipeppr-widget-gcode/done", this, this.onDone);
            chilipeppr.subscribe("/com-chilipeppr-widget-gcode/onpause", this, this.onPause);
        },
        formSetup: function() {
            var phone = $('#com-chilipeppr-elem-zipwhip-phone');
            var whendone = $('#com-chilipeppr-elem-zipwhip-whendone');
            var whenm6 = $('#com-chilipeppr-elem-zipwhip-whenm6');
            var testBtn = $('#com-chilipeppr-elem-zipwhip-testBtn');
            var that = this;
            
            // read settings
            this.getSettings();
            
            phone.blur(function() {
                console.log("got blur on phone:", phone.val());
                var ph = phone.val();
                that.formatPhoneViaCall(ph, function(formattedPhoneNumber) {
                    console.log("got formatted ph via webcall. resp:", formattedPhoneNumber);
                    $('#com-chilipeppr-elem-zipwhip-phone').val(formattedPhoneNumber);
                    // save settings
                    that.saveSettings();
                });
                //ph = that.formatInternationalNumber(ph);
                //console.log("formatted ph:", ph);
                
            });
            whendone.on('change', function() {
                console.log("checkbox changed");
                that.saveSettings();
            });
            whenm6.on('change', function() {
                console.log("whenm6 checkbox changed");
                that.saveSettings();
            });
            testBtn.click(function() {
                that.onTest();
            });
        },
        sendText: function(body) {
            // this method uses the Zipwhip api documented at zipwhip.com/api
            // we do GET methods into Zipwhip and proxy them thru ChiliPeppr so that
            // ChiliPeppr swaps in the sessionid for security
            // We get back direct ajax from Zipwhip but via ChiliPeppr proxy
            
            // format the phone number to ptn:/ format
            var pn = this.settings.phone;
            pn = pn.replace(/\D/g, ""); // remove anything but digits
            pn = "ptn:/" + pn;
            console.log("phone number:", pn);
            var url = "https://api.zipwhip.com/message/send";
            var data = {
                session: "-fill-from-server-session-",
                contacts: pn,
                body: body,
                //fromAddress:4
            };
            var urlget = url + "?" + $.param(data);
            console.log("going to use chilipeppr geturl. here's our getstr:", urlget);
            urlgetEncoded = encodeURIComponent(urlget);
            console.log("after encoding:", urlgetEncoded);
            //console.log("sending test msg. data:", data);
            
            $.ajax({
                url: "http://chilipeppr.com/zipwhip",
                //url: "http://localhost:8080/zipwhip",
                type: "GET",
                data: {url: urlget}
            })
            .done(function( data ) {
                console.log("data back", data);
                chilipeppr.publish("/com-chilipeppr-elem-flashmsg/flashmsg", "Zipwhip Text Message Sent", body);
            })
            .fail(function() {
                console.log( "error" );
                chilipeppr.publish("/com-chilipeppr-elem-flashmsg/flashmsg", "Zipwhip Text Message Error", "An error occurred sending text.");
            });
        },
        onTest: function() {
            
            $('#com-chilipeppr-elem-zipwhip-testBtn').prop('disabled', true);
            this.sendText("Test message.\n\nTexts courtesy of Zipwhip.com landline texting. Hope ur enjoying ChiliPeppr.");
            $('#com-chilipeppr-elem-zipwhip-body .test-send-status').text('Test Sent');
            setTimeout(function() {
                $('#com-chilipeppr-elem-zipwhip-testBtn').prop('disabled', false);
                $('#com-chilipeppr-elem-zipwhip-body .test-send-status').text('');
            }, 5000);
        },
        onDone: function(msg) {
            console.log("got onDone signal. send text.");
            // see if they have a phone and that they want an alert
            if (this.settings != null && this.settings.phone != null && this.settings.phone.length > 3) {
                if (this.settings.isSendWhenDone)
                    this.sendText("Gcode job done. " + msg + ". Texts courtesy of Zipwhip.com landline texting.");
                else
                    console.log("tried to send text but user did not want");
            } else {
                console.log("tried to send text but user did not fill out phone");
            }
        },
        onPause: function(param1, param2) {
            console.log("zipwhip texting. got onPause signal. param1:", param1, "param2:", param2);
            // see if they have a phone and that they want an alert
            if (this.settings != null && this.settings.phone != null && this.settings.phone.length > 3) {
                if (this.settings.isSendWhenM6) {
                    // Now that we're this deep, we still need to make sure this /onpause event is from an m6, not just from a user toggling
                    if (param1 == true && param2.match(/m6/i)) {
                        this.sendText("Tool change M6 just got hit. Texts courtesy of Zipwhip.com landline texting.");
                    }
                } else {
                    console.log("tried to send text but user did not want");
                }
            } else {
                console.log("tried to send text but user did not fill out phone");
            }
        },
        getSettings: function() {
            // read vals from cookies
            var options = $.cookie('com-chilipeppr-elem-zipwhip-options');
            
            if (true && options && options !== undefined) {
                options = $.parseJSON(options);
                console.log("just evaled options: ", options);
            } else {
                console.log("setting default settings");
                options = {phone: "", isSendWhenDone: true, isSendWhenM6: true};
            }
            this.settings = options;
            console.log("options:", options);
            
            // set form
            var phone = $('#com-chilipeppr-elem-zipwhip-phone');
            var whendone = $('#com-chilipeppr-elem-zipwhip-whendone');
            var whenm6 = $('#com-chilipeppr-elem-zipwhip-whenm6');
            
            phone.val(this.settings.phone);
            if (this.settings.isSendWhenDone)
                whendone.prop('checked', true);
            else
                whendone.prop('checked', false);
            if (this.settings.isSendWhenM6)
                whenm6.prop('checked', true);
            else
                whenm6.prop('checked', false);
            
            
            
        },
        saveSettings: function() {
            var phone = $('#com-chilipeppr-elem-zipwhip-phone');
            var whendone = $('#com-chilipeppr-elem-zipwhip-whendone');
            var whenm6 = $('#com-chilipeppr-elem-zipwhip-whenm6');
            
            var options = {
                phone: phone.val(),
                isSendWhenDone: whendone.prop('checked'),
                isSendWhenM6: whenm6.prop('checked')
            };
            var optionsStr = JSON.stringify(options);
            console.log("saving options:", options, "json.stringify:", optionsStr);
            // store cookie
            $.cookie('com-chilipeppr-elem-zipwhip-options', optionsStr, {
                expires: 365 * 10,
                path: '/'
            });
            this.settings = options;
        },
        formatInternationalNumber: function(value){
            Zw.locale = "US";
            value = replaceKeyPhoneLettersWithNumbers(value);
            try{
                var phoneNumberUtil = Zw.util.PhoneNumberUtil.getInstance();
                
                value = phoneNumberUtil.getRawPhoneNumber(value);
                console.log("raw:", value);
                
                var countryCode = phoneNumberUtil.getCountryNameFromInternationalPhoneNumber(value);
                var regionCode = phoneNumberUtil.getRegionCodeForPhoneNumber(value);
                //var phoneNumber = i18n.phonenumbers.PhoneNumberUtil.getInstance().parse(value, $('#country').val());
                var phoneNumber = i18n.phonenumbers.PhoneNumberUtil.getInstance().parse(value, "US");
                console.log("country:", countryCode, "region:", regionCode, "ph:", phoneNumber);
                
                regionCode = phoneNumberUtil.getRegionCodeFromLocalPhoneNumber(value);
                value = phoneNumberUtil.addPlusOneToNanpaPhoneNumber(value);
                console.log("country:", countryCode, "region:", regionCode, "ph:", value);
                
                value = phoneNumberUtil.formatE164(regionCode, value);
                countryCode = phoneNumberUtil.getCountryNameFromInternationalPhoneNumber(value);
                //console.log("country:", countryCode, "region:", regionCode, "ph:", phoneNumber);

                
                if(!countryCode || !regionCode){
                    value = phoneNumberUtil.addPlusOneToNanpaPhoneNumber(value);
                    countryCode = phoneNumberUtil.getCountryNameFromInternationalPhoneNumber(value);
                    regionCode = phoneNumberUtil.getRegionCodeForPhoneNumber(value);
                    
                }
                
                if(countryCode){
                    Zw.locale = regionCode;
                    var internationalValue = phoneNumberUtil.formatE164(regionCode, value);
                    var formattedPhoneNumber = phoneNumberUtil.formatLocal(regionCode, value);
                    $("#country-error").text("");
                    $("#country-error").css("display", "none");
                    Zw.locale != "US" ? $('#international-value').text(internationalValue) : $('#international-value').text(phoneNumberUtil.getRawPhoneNumber(formattedPhoneNumber));
                    $("#country").val(Zw.locale)
                    $('#com-chilipeppr-elem-zipwhip-phone').val(formattedPhoneNumber);
                    return;
                }
            }catch(e){
                console.log('Do nothing because the format failed');
                return "";
            }
            //we couldn't find a country code for the number
            $("#country-error").css("display", "block");
            var internationalDropDownError = "Example Format: " + phoneNumberUtil.formatLocal(Zw.locale, phoneNumberUtil.getExamplePhoneNumber());
            $("#country-error").text(internationalDropDownError);
            return;

        },
        forkSetup: function () {
            var topCssSelector = '#' + this.id; //com-chilipeppr-widget-tinyg';

            //$(topCssSelector + ' .fork').prop('href', this.fiddleurl);
            //$(topCssSelector + ' .standalone').prop('href', this.url);
            //$(topCssSelector + ' .fork-name').html(this.id);
            $(topCssSelector + ' .panel-title').popover({
                title: this.name,
                content: this.desc,
                html: true,
                delay: 200,
                animation: true,
                trigger: 'hover',
                placement: 'auto'
            });

            var that = this;
            chilipeppr.load("http://raw.githubusercontent.com/chilipeppr/widget-pubsubviewer/master/auto-generated-widget.html", function() {
            // chilipeppr.load("http://fiddle.jshell.net/chilipeppr/zMbL9/show/light/", function () {
                require(['inline:com-chilipeppr-elem-pubsubviewer'], function (pubsubviewer) {
                    pubsubviewer.attachTo($(topCssSelector + ' .panel-heading .dropdown-menu'), that);
                });
            });

        },
    }
});