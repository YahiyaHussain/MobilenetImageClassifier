import React, { useEffect } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import Card from '@material-ui/core/Card';
import CardHeader from '@material-ui/core/CardHeader';
import CardMedia from '@material-ui/core/CardMedia';
import CardContent from '@material-ui/core/CardContent';
import Typography from '@material-ui/core/Typography';
import { v4 as uuidv4 } from 'uuid';

const useStyles = makeStyles((theme) => ({
	root: {
		maxWidth: 350,
		marginTop: 30,
		marginLeft: 400,
	},
	media: {
		height: 0,
		paddingTop: '70.25%', // 16:9
	},
}));
const constructWebWorker = function (sourcePath, name) {
	const worker = new Worker(sourcePath);
	worker.addEventListener('error', (event) => {
		console.log(`[${name}] Error`, event.message, event);
	});
	return worker;
};

const workerAction = async function (worker, action, data) {
	const UUID = uuidv4();

	return new Promise((resolve) => {
		let selfDestructingEventHandler = (event) => {
			if (event.data.uuid === UUID) {
				worker.removeEventListener('message', selfDestructingEventHandler);
				resolve(event);
			}
		};
		worker.addEventListener('message', selfDestructingEventHandler);

		worker.postMessage({ action, ...data, uuid: UUID });
	});
};
async function predictImage(image, worker) {
	const canvas = document.createElement('canvas');
	const context = canvas.getContext('2d');
	context.drawImage(image, 0, 0);
	const imageData = context.getImageData(0, 0, image.width, image.height);
	return workerAction(worker, 'predict', { imageData }).then((message) => {
		const { prediction } = message.data;

		console.log(prediction);
		return prediction;
	});
}

// markup
const IndexPage = () => {
	const classes = useStyles();
	const [hovering, setHovering] = React.useState(false);
	const [imageURL, setImageURL] = React.useState(undefined);
	const [title, setTitle] = React.useState('Loading...');
	const [imageTitle, setImageTitle] = React.useState('');
	const cardRef = React.useRef(null);
	const [worker, setWorker] = React.useState();

	useEffect(() => {
		const newWorker = constructWebWorker('mobilenetworker.js', 'Worker');
		newWorker.postMessage({ action: 'init' });
		workerAction(newWorker, 'init').then(() => {
			setWorker(newWorker);
			setTitle('Drag or paste an image in!');
		});
	}, []);

	useEffect(() => {
		if (worker !== undefined) {
			window.addEventListener(
				'paste',
				function (pasteEvent) {
					const items = pasteEvent.clipboardData.items;
					processDataTransfer(items);
				},
				false
			);
			var dropbox = cardRef.current;

			dropbox.addEventListener('dragenter', dragenter, false);
			dropbox.addEventListener('dragleave', dragleave, false);
			dropbox.addEventListener('dragover', noopHandler, false);
			dropbox.addEventListener('drop', drop, false);

			function noopHandler(evt) {
				evt.stopPropagation();
				evt.preventDefault();
			}
			function dragenter(evt) {
				noopHandler(evt);
				setHovering(true);
			}
			function dragleave(evt) {
				noopHandler(evt);
				setHovering(false);
			}
			function drop(evt) {
				noopHandler(evt);
				setHovering(false);

				let imageURL = evt.dataTransfer.getData('Text');
				setImageURL(imageURL);

				const image = new Image();
				image.crossOrigin = 'Anonymous';
				image.addEventListener('load', () => {
					predictImage(image, worker).then((prediction) => setImageTitle(prediction));
				});
				image.addEventListener('error', () => {
					setImageTitle('Not a pure image URL try again');
				});

				image.src = imageURL;
			}
		}

		const processDataTransfer = function (items) {
			for (let i = 0; i < items.length; i++) {
				if (items[i].kind === 'file') {
					const imageFile = items[i].getAsFile();
					const imageURL = URL.createObjectURL(imageFile);
					const image = new Image();
					image.crossOrigin = 'Anonymous';
					image.addEventListener('load', () => {
						predictImage(image, worker).then((prediction) => setImageTitle(prediction));
					});

					image.src = imageURL;

					setImageURL(imageURL);
				}
			}
		};
	}, [cardRef, worker]);

	return (
		<div style={{ alignContent: 'center' }}>
			<Card ref={cardRef} className={classes.root}>
				<CardHeader title="MobileNet Image Classifier" subheader={title} />
				<CardMedia
					style={{ backgroundColor: hovering ? 'lightskyblue' : null, opacity: hovering ? 0.5 : 1 }}
					className={classes.media}
					image={imageURL}
				/>
				<CardContent>
					<Typography gutterBottom variant="h6" component="h2">
						{imageTitle}
					</Typography>
					<Typography variant="body2" color="textSecondary" component="p">
						Pasting or dragging an image in will pass the image into the TensorFlow.js MobileNet classifier
						and get its outputted prediction for the image and display it.
					</Typography>
				</CardContent>
			</Card>
		</div>
	);
};

export default IndexPage;
