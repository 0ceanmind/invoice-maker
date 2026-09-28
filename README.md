# Crapto Invoice Maker

A small invoice and bill builder for **Crapto Studio | Tech Solutions**. It replaces the Word templates: you fill in fields and stack blocks, and the layout stays aligned no matter what you type.

It runs entirely in the browser. There is no install, no account and no server.

## Open it

- **On your computer:** download or clone this repository and double-click `index.html` (Chrome, Edge, Safari or Firefox).
- **Online:** turn on GitHub Pages for this repository (Settings → Pages → Deploy from branch → `/ (root)`), then open the link it gives you.

## Make an invoice

1. Click **New** and choose **New English invoice** or **فاتورة جديدة بالعربية**. The number goes up by one automatically and today's date is filled in.
2. In **Invoice**, type the client name. Use **Add header field** for extras such as *Due date* or *PO number*.
3. In **Blocks**, open a block to edit it, or add a new one from the grid:

   | Block | Use it for |
   | --- | --- |
   | Title | The project or event name, centered above the table |
   | Items table | Services with quantity and price. Totals, discount, tax (e.g. 5% VAT), advance payment and a note under the table are calculated for you |
   | Bullet list | Scope of work or phases. One bullet per line; it can be red, and the text before `:` can be bold |
   | Text / note | Notes, terms, a thank-you line |
   | Custom fields | Any label and value pairs |
   | Payment details | Bank account and/or phone transfer, taken from your company profile |
   | Signature | Your closing line and signature, and/or a client signature line |
   | Space, Divider, Page break | Layout helpers |

   Blocks can be **half width** so two sit side by side. Reorder them with the arrows or by dragging the dotted handle. Click anything on the page preview to jump to its settings.
4. Click **Print / Save PDF** (or press Ctrl/⌘ + P) and choose **Save as PDF**. In the print dialog, keep *Margins: Default* and turn on *Background graphics* if your browser shows that option.

Everything saves automatically in your browser. **My invoices** lists every invoice, with search, export and delete. Use **Back up all** now and then, because clearing browser data also clears saved invoices. **Restore / import** brings a backup back.

Undo and redo work with the arrow buttons or Ctrl/⌘ + Z and Ctrl/⌘ + Shift + Z.

## Company details

**Company profile** (at the bottom of the editor) holds the details printed on every invoice, in English and Arabic:

- Crapto Studio | Tech Solutions
- Faisal Fahad Albusaidi / فيصل فهد البوسعيدي
- Phone +96894442029
- Bank Muscat / بنك مسقط, account 0348075139250013
- Currency OMR / ر.ع (ريال عماني in totals)
- Logo and signature, with buttons to upload new ones or return to the originals

## Design

The design follows the original bills: the **Rubik** typeface (bundled in `assets/fonts`, so it works offline), black and white with grey `#808080` table headers, `#F2F2F2` rows, a black total bar, a black client bar that runs to the page edge, and red `#EE0000` for highlighted lists. Arabic invoices flip right-to-left automatically and can use Arabic numerals (١٢٣).

Both original bills are included as starting examples under **New → Original bill**.

## Files

```
index.html         App shell
css/app.css        Editor interface
css/invoice.css    The printed invoice (edit this to change the invoice look)
css/fonts.css      Local Rubik font
js/data.js         Company details, labels (English/Arabic), block types and the two sample bills
js/app.js          Editor, live preview, totals, saving and printing
assets/            Logo, signature and fonts
```
