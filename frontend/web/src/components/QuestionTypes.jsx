import React, { useState } from 'react';
import { 
  TextField, 
  FormControl, 
  FormControlLabel, 
  RadioGroup, 
  Radio, 
  Checkbox, 
  FormGroup, 
  Typography, 
  Paper, 
  Box,
  Grid,
  Button,
  Card,
  CardContent
} from '@mui/material';

/**
 * Component for rendering and answering True/False questions
 */
export const TrueFalseQuestion = ({ question, onChange, value, disabled }) => {
  return (
    <Card variant="outlined" sx={{ mb: 2 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          {question.content}
        </Typography>
        <FormControl component="fieldset" disabled={disabled}>
          <RadioGroup
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
          >
            <FormControlLabel value="true" control={<Radio />} label="True" />
            <FormControlLabel value="false" control={<Radio />} label="False" />
          </RadioGroup>
        </FormControl>
      </CardContent>
    </Card>
  );
};

/**
 * Component for rendering and answering Multiple Choice questions
 */
export const MultipleChoiceQuestion = ({ question, onChange, value, disabled }) => {
  return (
    <Card variant="outlined" sx={{ mb: 2 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          {question.content}
        </Typography>
        <FormControl component="fieldset" disabled={disabled}>
          <RadioGroup
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
          >
            {question.options.map((option, index) => (
              <FormControlLabel
                key={index}
                value={option.id || option.value || String(index)}
                control={<Radio />}
                label={option.text || option}
              />
            ))}
          </RadioGroup>
        </FormControl>
      </CardContent>
    </Card>
  );
};

/**
 * Component for rendering and answering Multiple Answer questions
 */
export const MultipleAnswerQuestion = ({ question, onChange, value = [], disabled }) => {
  const handleChange = (optionId) => {
    const newValue = [...value];
    const index = newValue.indexOf(optionId);
    
    if (index === -1) {
      newValue.push(optionId);
    } else {
      newValue.splice(index, 1);
    }
    
    onChange(newValue);
  };
  
  return (
    <Card variant="outlined" sx={{ mb: 2 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          {question.content}
        </Typography>
        <Typography variant="body2" color="textSecondary" gutterBottom>
          Select all that apply
        </Typography>
        <FormControl component="fieldset" disabled={disabled}>
          <FormGroup>
            {question.options.map((option, index) => (
              <FormControlLabel
                key={index}
                control={
                  <Checkbox
                    checked={value.includes(option.id || option.value || String(index))}
                    onChange={() => handleChange(option.id || option.value || String(index))}
                  />
                }
                label={option.text || option}
              />
            ))}
          </FormGroup>
        </FormControl>
      </CardContent>
    </Card>
  );
};

/**
 * Component for rendering and answering Matching questions
 */
export const MatchingQuestion = ({ question, onChange, value = {}, disabled }) => {
  const [matches, setMatches] = useState(value);
  
  const handleChange = (leftId, rightId) => {
    const newMatches = { ...matches, [leftId]: rightId };
    setMatches(newMatches);
    onChange(newMatches);
  };
  
  return (
    <Card variant="outlined" sx={{ mb: 2 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          {question.content}
        </Typography>
        <Typography variant="body2" color="textSecondary" gutterBottom>
          Match items from the left column with items in the right column
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle1" gutterBottom>
              Items
            </Typography>
            {question.options.left.map((item, index) => (
              <Box key={index} sx={{ mb: 2 }}>
                <Paper elevation={1} sx={{ p: 2 }}>
                  <Grid container spacing={2} alignItems="center">
                    <Grid item xs={8}>
                      <Typography>{item.text}</Typography>
                    </Grid>
                    <Grid item xs={4}>
                      <FormControl fullWidth disabled={disabled}>
                        <select
                          value={matches[item.id] || ''}
                          onChange={(e) => handleChange(item.id, e.target.value)}
                          style={{ padding: '8px' }}
                        >
                          <option value="">Select match</option>
                          {question.options.right.map((rightItem, rightIndex) => (
                            <option key={rightIndex} value={rightItem.id}>
                              {rightItem.text}
                            </option>
                          ))}
                        </select>
                      </FormControl>
                    </Grid>
                  </Grid>
                </Paper>
              </Box>
            ))}
          </Grid>
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle1" gutterBottom>
              Matches
            </Typography>
            {question.options.right.map((item, index) => (
              <Box key={index} sx={{ mb: 2 }}>
                <Paper elevation={1} sx={{ p: 2 }}>
                  <Typography>{item.text}</Typography>
                </Paper>
              </Box>
            ))}
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
};

/**
 * Component for rendering and answering Short Answer questions
 */
export const ShortAnswerQuestion = ({ question, onChange, value = '', disabled }) => {
  return (
    <Card variant="outlined" sx={{ mb: 2 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          {question.content}
        </Typography>
        <TextField
          fullWidth
          multiline
          rows={2}
          variant="outlined"
          placeholder="Enter your answer"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          sx={{ mt: 2 }}
        />
      </CardContent>
    </Card>
  );
};

/**
 * Component for rendering and answering Essay questions
 */
export const EssayQuestion = ({ question, onChange, value = '', disabled }) => {
  return (
    <Card variant="outlined" sx={{ mb: 2 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          {question.content}
        </Typography>
        {question.rubric && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" color="primary">
              Rubric:
            </Typography>
            <Typography variant="body2">
              {question.rubric.description}
            </Typography>
          </Box>
        )}
        <TextField
          fullWidth
          multiline
          rows={6}
          variant="outlined"
          placeholder="Enter your essay"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          sx={{ mt: 2 }}
        />
      </CardContent>
    </Card>
  );
};

/**
 * Component for rendering and answering Fill-in-the-blank questions
 */
export const FillInBlankQuestion = ({ question, onChange, value = {}, disabled }) => {
  const [answers, setAnswers] = useState(value);
  
  const handleChange = (blankId, answer) => {
    const newAnswers = { ...answers, [blankId]: answer };
    setAnswers(newAnswers);
    onChange(newAnswers);
  };
  
  // Parse content to find blanks
  const renderContent = () => {
    if (!question.options || !question.options.blanks) {
      return <Typography>{question.content}</Typography>;
    }
    
    const parts = question.content.split(/\{\{blank-[0-9]+\}\}/);
    const blanks = question.options.blanks;
    
    return (
      <Box>
        {parts.map((part, index) => (
          <React.Fragment key={index}>
            <Typography component="span">{part}</Typography>
            {index < parts.length - 1 && (
              <TextField
                variant="standard"
                size="small"
                value={answers[blanks[index].id] || ''}
                onChange={(e) => handleChange(blanks[index].id, e.target.value)}
                disabled={disabled}
                sx={{ mx: 1, width: blanks[index].width || 100 }}
              />
            )}
          </React.Fragment>
        ))}
      </Box>
    );
  };
  
  return (
    <Card variant="outlined" sx={{ mb: 2 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Fill in the blanks:
        </Typography>
        {renderContent()}
      </CardContent>
    </Card>
  );
};

/**
 * Component for rendering and answering Computational questions
 */
export const ComputationalQuestion = ({ question, onChange, value = '', disabled }) => {
  return (
    <Card variant="outlined" sx={{ mb: 2 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          {question.content}
        </Typography>
        {question.options && question.options.formula && (
          <Box sx={{ my: 2, p: 2, bgcolor: 'background.paper' }}>
            <Typography variant="body2" component="pre">
              {question.options.formula}
            </Typography>
          </Box>
        )}
        <TextField
          fullWidth
          variant="outlined"
          placeholder="Enter your answer"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          sx={{ mt: 2 }}
        />
      </CardContent>
    </Card>
  );
};

/**
 * Component for rendering and answering Diagram-based questions
 */
export const DiagramQuestion = ({ question, onChange, value = null, disabled }) => {
  const [imageFile, setImageFile] = useState(value);
  
  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      onChange(file);
    }
  };
  
  return (
    <Card variant="outlined" sx={{ mb: 2 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          {question.content}
        </Typography>
        {question.options && question.options.referenceImage && (
          <Box sx={{ my: 2 }}>
            <Typography variant="subtitle2">Reference Image:</Typography>
            <img 
              src={question.options.referenceImage} 
              alt="Reference" 
              style={{ maxWidth: '100%', maxHeight: '300px' }} 
            />
          </Box>
        )}
        <Box sx={{ mt: 2 }}>
          <input
            accept="image/*"
            id={`diagram-upload-${question.id}`}
            type="file"
            onChange={handleFileChange}
            disabled={disabled}
            style={{ display: 'none' }}
          />
          <label htmlFor={`diagram-upload-${question.id}`}>
            <Button
              variant="contained"
              component="span"
              disabled={disabled}
            >
              Upload Diagram
            </Button>
          </label>
          {imageFile && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2">Your uploaded diagram:</Typography>
              <img 
                src={typeof imageFile === 'string' ? imageFile : URL.createObjectURL(imageFile)} 
                alt="Uploaded diagram" 
                style={{ maxWidth: '100%', maxHeight: '300px' }} 
              />
            </Box>
          )}
        </Box>
      </CardContent>
    </Card>
  );
};

/**
 * Component for rendering and answering Coding questions
 */
export const CodingQuestion = ({ question, onChange, value = '', disabled }) => {
  return (
    <Card variant="outlined" sx={{ mb: 2 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          {question.content}
        </Typography>
        {question.options && question.options.instructions && (
          <Typography variant="body2" sx={{ mb: 2 }}>
            {question.options.instructions}
          </Typography>
        )}
        {question.options && question.options.starterCode && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2">Starter Code:</Typography>
            <pre style={{ backgroundColor: '#f5f5f5', padding: '10px', borderRadius: '4px' }}>
              {question.options.starterCode}
            </pre>
          </Box>
        )}
        <Box sx={{ mt: 2 }}>
          <TextField
            fullWidth
            multiline
            rows={10}
            variant="outlined"
            placeholder="Write your code here"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            sx={{ fontFamily: 'monospace' }}
          />
        </Box>
      </CardContent>
    </Card>
  );
};

/**
 * Component for rendering and answering Oral questions
 */
export const OralQuestion = ({ question, onChange, value = null, disabled }) => {
  const [recording, setRecording] = useState(false);
  const [audioURL, setAudioURL] = useState(value);
  
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Recording logic would go here
      setRecording(true);
    } catch (err) {
      console.error('Error accessing microphone:', err);
      alert('Error accessing microphone. Please check permissions.');
    }
  };
  
  const stopRecording = () => {
    setRecording(false);
    // Stop recording logic would go here
  };
  
  return (
    <Card variant="outlined" sx={{ mb: 2 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          {question.content}
        </Typography>
        <Box sx={{ mt: 2 }}>
          {!recording ? (
            <Button
              variant="contained"
              color="primary"
              onClick={startRecording}
              disabled={disabled || recording}
              sx={{ mr: 1 }}
            >
              Start Recording
            </Button>
          ) : (
            <Button
              variant="contained"
              color="secondary"
              onClick={stopRecording}
              disabled={disabled || !recording}
            >
              Stop Recording
            </Button>
          )}
          
          {audioURL && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2">Your recording:</Typography>
              <audio controls src={audioURL} />
            </Box>
          )}
        </Box>
      </CardContent>
    </Card>
  );
};

/**
 * Factory function to render the appropriate question component based on type
 */
export const QuestionRenderer = ({ question, onChange, value, disabled }) => {
  switch (question.type) {
    case 'true_false':
      return <TrueFalseQuestion question={question} onChange={onChange} value={value} disabled={disabled} />;
    case 'multiple_choice':
      return <MultipleChoiceQuestion question={question} onChange={onChange} value={value} disabled={disabled} />;
    case 'multiple_answer':
      return <MultipleAnswerQuestion question={question} onChange={onChange} value={value} disabled={disabled} />;
    case 'matching':
      return <MatchingQuestion question={question} onChange={onChange} value={value} disabled={disabled} />;
    case 'short_answer':
      return <ShortAnswerQuestion question={question} onChange={onChange} value={value} disabled={disabled} />;
    case 'essay':
      return <EssayQuestion question={question} onChange={onChange} value={value} disabled={disabled} />;
    case 'fill_in_blank':
      return <FillInBlankQuestion question={question} onChange={onChange} value={value} disabled={disabled} />;
    case 'computational':
      return <ComputationalQuestion question={question} onChange={onChange} value={value} disabled={disabled} />;
    case 'diagram':
      return <DiagramQuestion question={question} onChange={onChange} value={value} disabled={disabled} />;
    case 'coding':
      return <CodingQuestion question={question} onChange={onChange} value={value} disabled={disabled} />;
    case 'oral':
      return <OralQuestion question={question} onChange={onChange} value={value} disabled={disabled} />;
    default:
      return (
        <Card variant="outlined" sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="h6" color="error">
              Unsupported question type: {question.type}
            </Typography>
          </CardContent>
        </Card>
      );
  }
};