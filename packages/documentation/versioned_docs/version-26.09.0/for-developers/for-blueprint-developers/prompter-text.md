# Prompter Text Formatting

The Sofie Prompter supports formatted text using simple inline markers. This formatting is displayed both in the prompter view and in hover previews throughout the Sofie UI.

Providing formatted text is optional, Sofie will use the un-formatted version when only that is provided.

## Emphasis and Strong

Wrap text to add emphasis or bold:

- `*italic*` or `_italic_` → _italic_
- `**bold**` or `__bold__` → **bold**

```text
This is *emphasized text* and this is **strong text**.
```

## Invert Color

Invert the text colour (swap foreground/background):

```text
Show ~reversed~ for emphasis.
```

## Hidden Text

Hide text from display using `|` or `$` — useful for notes or off-script remarks:

```text
Begin the speech |remember to smile| then continue.
```

## Underline

Use double markers `||` or `$$` to underline text:

```text
This word is ||underlined|| for emphasis.
```

## Colour

Apply colour using `[colour=#hex]...[/colour]`:

```text
[colour=#ffff00]This text appears in yellow[/colour]
[colour=#ff0000]This text appears in red[/colour]
```

## Screen Marker

Insert a screen marker for teleprompter control using `(X)`:

```text
Begin speech (X) pause here, then continue.
```

## Escaping

Prefix any special character with `\` to display it literally:

```text
This is \*not italic\* and this is \~not reversed\~.
```

## Full Example

```text
Good morning, *everyone*.
|Don't forget the greeting| Welcome to the ||annual conference||.
[colour=#ffff00]Please note[/colour] the schedule has changed. (X)
For questions, contact us at example\@email.com.
```
