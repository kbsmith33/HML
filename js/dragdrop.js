/* global runState, instRow */

/**
 * Allow an instruction to be dropped on this element
 * 
 * @param {DropEvent} ev
 */
function allowDropInstruction(ev) {
    ev.preventDefault();
}

/** 
 * Handle an instruction being dragged
 * 
 * @param {DragEvent} ev
 */
function dragInstruction(ev) {
    let item = $(ev.target);

    if (!(item.is(".instruction"))) {
        item = item.parents(".instruction");
    }

    let source = "instructionBank";
    let lineno = -1;

    if (item.parents("#program").length > 0) {
        source = "program";
        lineno = $(item.parents("tbody")).find("tr").index(item.parents("tr")) + 1;
    }

    let dragItem = {
        thing: "instruction",
        src: source,
        line: lineno,
        item: item.clone(true, true)[0].outerHTML
    };

    ev.dataTransfer.setData("text", JSON.stringify(dragItem));
}

/**
 * Handle an instruction being dropped into the program
 * 
 * @param {DropEvent} ev
 */
function dropInstruction(ev) {
    ev.preventDefault();

    // Get the item being dropped
    let data = JSON.parse(ev.dataTransfer.getData("text"));

    if (data.thing !== "instruction") {
        return;
    }

    // and the place it was dropped
    let target = $(ev.target);

    if (!(target.is('td'))) {
        // If the drop location was not a table cell

        // Find the parent table cell
        target = target.parents("td");
    }

    // If dragging from the program and the ctrl or shift Key wasn't pressed
    if (data.src === "program" && !(ev.ctrlKey === true || ev.shiftKey === true)) {
        // delete the original instruction
        $($("#program tbody tr")[data.line - 1]).find(".instructioncell").empty();
    }

    // If the target is currently empty
    if (target.has('.instruction').length === 0) {
        // add the instruction to the target
        target.append(data.item);
    } else {
        // If there was an instruction where the new one was dropped
        // Insert a new row

        let curRow = target.parents("tr");

        curRow.before(instRow);

        let newRow = curRow.parents("tbody").find("tr").index(curRow) - 1;

        $(curRow.parent("tbody").find("tr")[newRow]).find(".instructioncell").append(data.item);

        fixJumps(newRow + 1, 1);
    }

    // Update the program display
    compactLines();
    setLineNumbers();
    fillPositionDropdowns();
    addDropdownHandlers();
    setURLCode();
}

/**
 * Handle an instruction being dropped outside the program editor
 * 
 * @param {DropEvent} ev
 */
function trashInstruction(ev) {
    ev.preventDefault();

    // Get the item being dropped
    let data = JSON.parse(ev.dataTransfer.getData("text"));

    if (data.thing !== "instruction") {
        return;
    }

    // and the place it was dropped
    let target = $(ev.target);

    // If dragging from the program
    if (data.src === "program") {
        // delete the original instruction
        $($("#program tbody tr")[data.line - 1]).find(".instructioncell").empty();
    }

    // Update the program display
    compactLines();
    setLineNumbers();
    fillPositionDropdowns();
    addDropdownHandlers();
    setURLCode();
}

/** 
 * Handle an card being dragged
 * 
 * @param {DragEvent} ev
 */
function dragCard(ev) {
    let item = $(ev.target);

    let pos = $(item.parents("tr")).find("td").index(item.parents("td"));


    let dragItem = {
        thing: "card",
        item: item.attr('value'),
        pos: pos
    };

    let text = JSON.stringify(dragItem);
    ev.dataTransfer.setData("text", text);
}
/**
 * Handle a card being dropped onto another element
 * @param {DropEvent} ev
 */
function dropCard(ev) {
    // Get the item being dropped
    let source = JSON.parse(ev.dataTransfer.getData("text"));

    // and the place it was dropped
    let target = $(ev.target);

    // If the thing being dropped isn't a card
    if (typeof (source.thing) === 'undefined' ||
            source.thing !== "card") {
        // It can't be dropped here
        return;
    }

    // Allow the card to be dropped
    ev.preventDefault();

    // If the card was droped on another card
    if (!target.is('td')) {
        // Find the parent table cell
        target = target.parents("td");
    }

    // Find the position of the target
    let targetpos = $(target.parents("tr")).find("td").index(target);

    // calculate the direction from target to source
    let dir = -1;
    if (targetpos > source.pos) {
        dir = 1;
    }

    // Get the list of card cells
    let cardcells = target.siblings().addBack();

    // Get the source cell and its card
    let sourceCell = $(cardcells[source.pos]);
    let sourceCard = sourceCell.find('.cardItem');

    // Pull the source card out of its cell
    sourceCard.detach();
    let tCell = sourceCell;

    // Loop from the source to the target, moving cards over
    for (let i = source.pos; i !== targetpos; i = i + dir) {
        let cell = $(cardcells[i + dir]);
        let card = cell.find('.cardItem');
        card.detach();

        tCell.append(card);
        tCell = cell;
    }

    // Put the source card into the target position
    $(target).append(sourceCard);

    // Update the url with the cards in place
    setURLCards();
}

/**
 * Allow a card to be dropped in this location
 * 
 * @param {DragEvent} ev
 */
function allowCardDrop(ev) {
    ev.preventDefault();
}

/**
 * Adjust all jumps from a given linenumber to the end of the program
 * so that their target line numbers have a delta added to them to
 * account for, ie inserted or removed lines of code.
 * 
 * @param {Number} changeLine the line number to start adjustments
 *    around
 * 
 * @param {Number} delta the direction and amount to adjust jump
 *  target line numbers
 */
function fixJumps(changeLine, delta) {
    // Find all lines in the program
    let lines = $("#program tbody tr");

    // loop through all of the lines
    for (let i = 0; i < lines.length; i++) {
        // if this line is a jump instruction
        $(lines[i]).find('.jump, .jumpif').each(function () {
            // Find the linenum of the jump target
            $(this).find('.fillin.linenum').each(function () {
                let oldnum = parseInt($(this).val());

                // replace the linenum
                if (!isNaN(oldnum) && oldnum >= changeLine) {
                    setDropdown($(this), oldnum + delta);
                }
            });

        });
    }
}

/**
 * Remove all blank lines in the program, and add one blank line at
 * the end of the program.
 */
function compactLines() {
    // Look at every program line
    $("#program tbody tr").each(function () {
        // If this line doesn't have an instruction
        if ($(this).find(".instruction").length === 0) {
            // Get its line number
            let lineno = parseInt($(this).find('.linenumcell').text());

            // Fix jumps to every line after this one
            fixJumps(lineno + 1, -1);

            // Remove this blank line
            $(this).remove();
        }
    });

    $("#program tbody").append(instRow);
}

/**
 * Set the available line numbers in all line number dropdowns and 
 * on all program lines
 */
function setLineNumbers() {
    // Find the number of program lines
    let numLines = $("#program tbody tr").length;

    // For every linenum list item in the program
    $(".linenum").each(function () {
        let cur = $(this).attr('data');
        
        // Clear out all existing line numbers in the list
        $(this).empty();
        
        // Add new linenumbers into the list
        for (let i = 0; i <= numLines; i++) {
            let option = $('<option>');
            
            if (i === 0) {
                option.val("x")
                      .text("Line #")
                      .css("display", "none");
            }
            else {
                option.val("" + i)
                      .text("" + i);
            }
            
            if (option.val() === cur) {
                option.attr("selected", "true");
            }
            
            $(this).append(option);
        }
    });

    // For every linenumber cell in the program
    $("tbody .linenumcell").each(function () {
        // Set the linenumber of the line
        $(this).html($(this).parents("tbody").find("tr").index($(this).parent("tr")) + 1);
    });
}

/**
 * Fill the value and position dropdowns
 */
function fillPositionDropdowns() {
    let movePos = ["Position", "Right Hand Position", "Left Hand Position", "Min Position",
                   "Max Position"];
    let moveVal = ["x", "r", "l", "i", "a"];
               
    let jumpList = ["Value", "Right Hand Card", "Left Hand Card", "Right Hand Position",
                   "Left Hand Position", "Min Position", "Max Position"];
    let jumpVal = ["x", "R", "L", "r", "l", "i", "a"];
    
    // Add all possible positions to menu
    for (let i = 0; i < runState.numCards; i++) {
        movePos.push("" + i);
        moveVal.push("" + i);
    }

    // Build move position menus
    let moveMenus = $('.fillin.pos');
    moveMenus.each(function() {
        let cur = $(this).attr('data');
        
        $(this).empty();
        for (let i = 0; i < movePos.length; i++) {
            let option = $('<option>');

            if (i === 0) {
                option.css('display', 'none');
            }

            option.val(moveVal[i])
                  .text(movePos[i])
                  .attr("selected", option.val() === cur);
            
            $(this).append(option);
        }
        
        let text = $(this).find('option:selected').text();
        setDropdownWidth($(this), text);
    });
    
    // Build Jump value menus
    let jumpValMenus = $('.fillin.value');    
    jumpValMenus.each(function() {  
        let cur = $(this).attr('data');
        
        $(this).empty();
        for (let i = 0; i < jumpList.length; i++) {
            let option = $('<option>');

            if (i === 0) {
                option.css('display', 'none');
            }

            option.val(jumpVal[i])
                  .text(jumpList[i])
                  .attr("selected", option.val() === cur);
            
            $(this).append(option);
        }
        
        // fulllists also have all of the possible card positions / values
        if ($(this).is('.fulllist')) {
            for (let i = 0; i <= runState.maxCard; i++) {
                let option = $('<option>');

                option.val(i)
                      .text(i)
                      .attr("selected", option.val() === cur);
                
                $(this).append(option);
            }        
        }
        
        // Resize the width of this dropdown to fit the text it contains
        let text = $(this).find('option:selected').text();
        setDropdownWidth($(this), text);
    });       
}

/**
 * Delete all instructions in the program code
 */
function deleteCode() {
    if (confirm("Press OK to delete ALL of your code.")) {
        // Remove all program code lines
        $("#program tbody tr").remove();

        // Compact the program, add a blank line
        compactLines();

        // Renumber the blank line
        setLineNumbers();
    }
}